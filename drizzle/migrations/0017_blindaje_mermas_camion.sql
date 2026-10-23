CREATE OR REPLACE FUNCTION public.cerrar_carga_camion(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid:=public.current_organization_id(); uid uuid:=auth.uid(); cid uuid:=(p->>'id')::uuid; c public.cargas_camion; r record; saldo numeric; perdida numeric;
BEGIN
 IF uid IS NULL OR org IS NULL OR NOT public.is_staff(uid) THEN RAISE EXCEPTION 'No autorizado'; END IF;
 SELECT * INTO c FROM cargas_camion WHERE id=cid AND organization_id=org FOR UPDATE;
 IF NOT FOUND OR (c.vendedor_id<>uid AND NOT public.is_admin(uid)) THEN RAISE EXCEPTION 'No autorizado'; END IF;
 IF c.estado='cerrada' THEN RETURN cid; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(p->'mermas','[]')) x WHERE (x->>'cantidad')::numeric>0 AND NULLIF(btrim(x->>'motivo'),'') IS NULL) THEN RAISE EXCEPTION 'Indique la justificación de cada producto en merma'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(p->'mermas','[]')) x WHERE x->>'cantidad' IS NULL OR (x->>'cantidad')::numeric<0 OR (x->>'cantidad')::numeric::text IN ('NaN','Infinity','-Infinity') OR NOT EXISTS(SELECT 1 FROM cargas_camion_detalle d WHERE d.carga_id=cid AND d.producto_id=(x->>'producto_id')::uuid)) THEN RAISE EXCEPTION 'Merma inválida'; END IF;
 FOR r IN SELECT * FROM cargas_camion_detalle WHERE carga_id=cid ORDER BY producto_id FOR UPDATE LOOP
 saldo:=r.preventa+r.extra-r.vendido-r.devuelto-r.merma;
 SELECT COALESCE(sum((x->>'cantidad')::numeric),0) INTO perdida FROM jsonb_array_elements(COALESCE(p->'mermas','[]')) x WHERE (x->>'producto_id')::uuid=r.producto_id;
 IF perdida>saldo THEN RAISE EXCEPTION 'La merma supera el sobrante'; END IF;
 UPDATE productos SET existencia=existencia+saldo-perdida WHERE id=r.producto_id AND organization_id=org;
 UPDATE cargas_camion_detalle SET devuelto=devuelto+saldo-perdida,merma=merma+perdida WHERE id=r.id;
 IF saldo-perdida>0 THEN INSERT INTO movimientos_inventario(organization_id,producto_id,tipo,cantidad,motivo,usuario_id) VALUES(org,r.producto_id,'entrada',saldo-perdida,'Sobrantes de camión '||cid,uid); END IF;
 END LOOP;
 UPDATE pedidos SET estado='confirmado',carga_id=NULL WHERE carga_id=cid AND estado NOT IN ('entregado','anulado');
 UPDATE cargas_camion SET estado='cerrada',cerrada_en=now(),notas=concat_ws(E'\n',notas,p->>'notas') WHERE id=cid;
 INSERT INTO auditoria(organization_id,usuario_id,accion,entidad,detalle) VALUES(org,uid,'cerrar_carga_camion','cargas_camion',p);
 RETURN cid;
END $$;
REVOKE ALL ON FUNCTION public.cerrar_carga_camion(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cerrar_carga_camion(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.cierre_global_ruta(p jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE org uuid:=public.current_organization_id(); uid uuid:=auth.uid(); cid uuid:=(p->>'carga_id')::uuid; c public.cargas_camion;
 vid uuid:=gen_random_uuid(); crid uuid; r record; it jsonb; disp numeric; sob numeric; mer numeric; vend numeric; precio numeric;
 total_v numeric:=0; contado numeric:=COALESCE((p->>'contado')::numeric,0); cred numeric:=COALESCE((p->>'credito')::numeric,0); mermas jsonb:='[]'; cierre uuid;
BEGIN
 IF uid IS NULL OR org IS NULL OR NOT public.is_admin(uid) THEN RAISE EXCEPTION 'Solo administradores pueden cerrar la ruta'; END IF;
 IF contado<0 OR cred<0 THEN RAISE EXCEPTION 'Montos inválidos'; END IF;
 SELECT * INTO c FROM cargas_camion WHERE id=cid AND organization_id=org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Carga no encontrada'; END IF;
 IF c.estado<>'en_ruta' THEN RAISE EXCEPTION 'Esta carga ya está cerrada'; END IF;
 INSERT INTO ventas(id,organization_id,cliente_id,ruta_id,vendedor_id,subtotal,descuento,total,metodo_pago,carga_id) VALUES(vid,org,NULL,c.ruta_id,c.vendedor_id,0,0,0,CASE WHEN cred>0 THEN 'credito' ELSE 'contado' END::metodo_pago,cid);
 FOR r IN SELECT * FROM cargas_camion_detalle WHERE carga_id=cid ORDER BY producto_id FOR UPDATE LOOP
 disp:=r.preventa+r.extra-r.vendido-r.devuelto-r.merma;
 SELECT x INTO it FROM jsonb_array_elements(COALESCE(p->'items','[]')) x WHERE (x->>'producto_id')::uuid=r.producto_id LIMIT 1;
 sob:=COALESCE((it->>'sobrante')::numeric,0); mer:=COALESCE((it->>'merma')::numeric,0); precio:=(it->>'precio')::numeric;
 IF sob<0 OR mer<0 OR sob+mer>disp THEN RAISE EXCEPTION 'Sobrante y merma de % superan lo que quedó en el camión',r.nombre_producto; END IF;
 vend:=disp-sob-mer;
 IF vend>0 THEN
 IF precio IS NULL OR precio<0 THEN RAISE EXCEPTION 'Falta el precio de %',r.nombre_producto; END IF;
 INSERT INTO detalle_ventas(organization_id,venta_id,producto_id,nombre_producto,cantidad,precio_unitario,total_linea) VALUES(org,vid,r.producto_id,r.nombre_producto,vend,precio,vend*precio);
 UPDATE cargas_camion_detalle SET vendido=vendido+vend WHERE id=r.id;
 total_v:=total_v+vend*precio;
 END IF;
 IF mer>0 THEN mermas:=mermas||jsonb_build_array(jsonb_build_object('producto_id',r.producto_id,'cantidad',mer,'motivo',it->>'motivo')); END IF;
 END LOOP;
 IF total_v=0 THEN DELETE FROM ventas WHERE id=vid; vid:=NULL; ELSE UPDATE ventas SET subtotal=total_v,total=total_v WHERE id=vid; END IF;
 IF cred>0 THEN INSERT INTO creditos(organization_id,venta_id,cliente_id,ruta_id,monto,saldo,estado,fecha_limite) VALUES(org,vid,NULL,c.ruta_id,cred,cred,'al_dia',current_date+30) RETURNING id INTO crid; END IF;
 INSERT INTO cierres_ruta(organization_id,carga_id,ruta_id,venta_id,credito_id,fecha,total_vendido,contado,credito,diferencia,notas,usuario_id) VALUES(org,cid,c.ruta_id,vid,crid,c.fecha,total_v,contado,cred,contado+cred-total_v,p->>'notas',uid) RETURNING id INTO cierre;
 PERFORM public.cerrar_carga_camion(jsonb_build_object('id',cid,'notas',concat_ws(' · ','Cierre global de ruta',p->>'notas'),'mermas',mermas));
 RETURN cierre;
END $$;
REVOKE ALL ON FUNCTION public.cierre_global_ruta(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cierre_global_ruta(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.registrar_merma_camion(p jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid:=public.current_organization_id(); uid uuid:=auth.uid(); op uuid:=(p->>'id')::uuid; cid uuid:=(p->>'carga_id')::uuid; pid uuid:=(p->>'producto_id')::uuid; cantidad numeric:=(p->>'cantidad')::numeric; motivo text:=NULLIF(btrim(p->>'motivo'),''); c public.cargas_camion; d public.cargas_camion_detalle;
BEGIN
 IF uid IS NULL OR org IS NULL OR NOT (public.has_role(uid,'vendedor') OR public.is_admin(uid)) THEN RAISE EXCEPTION 'No autorizado'; END IF;
 IF op IS NULL OR cantidad IS NULL OR cantidad<=0 OR cantidad::text IN ('NaN','Infinity','-Infinity') OR motivo IS NULL THEN RAISE EXCEPTION 'Indique una cantidad válida y la justificación de la merma'; END IF;
 SELECT * INTO c FROM cargas_camion WHERE id=cid AND organization_id=org FOR UPDATE;
 IF NOT FOUND OR (c.vendedor_id<>uid AND NOT public.is_admin(uid)) THEN RAISE EXCEPTION 'No autorizado para este camión'; END IF;
 IF EXISTS(SELECT 1 FROM auditoria WHERE organization_id=org AND accion='merma_camion' AND detalle->>'id'=op::text) THEN RETURN op; END IF;
 IF c.estado<>'en_ruta' THEN RAISE EXCEPTION 'La carga está cerrada'; END IF;
 SELECT * INTO d FROM cargas_camion_detalle WHERE carga_id=cid AND producto_id=pid AND organization_id=org FOR UPDATE;
 IF NOT FOUND OR cantidad>d.preventa+d.extra-d.vendido-d.devuelto-d.merma THEN RAISE EXCEPTION 'La merma supera las unidades a bordo'; END IF;
 UPDATE cargas_camion_detalle SET merma=merma+cantidad WHERE id=d.id;
 UPDATE cargas_camion SET notas=concat_ws(E'\n',notas,'Merma: '||d.nombre_producto||' · '||cantidad||' unidades · '||motivo),updated_at=now() WHERE id=cid;
 INSERT INTO auditoria(organization_id,usuario_id,accion,entidad,detalle) VALUES(org,uid,'merma_camion','cargas_camion',p||jsonb_build_object('fecha',now(),'nombre_producto',d.nombre_producto));
 RETURN op;
END $$;
REVOKE ALL ON FUNCTION public.registrar_merma_camion(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registrar_merma_camion(jsonb) TO authenticated;