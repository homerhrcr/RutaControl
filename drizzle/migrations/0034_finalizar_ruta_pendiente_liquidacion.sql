ALTER TABLE public.cargas_camion DROP CONSTRAINT cargas_camion_estado_check;
ALTER TABLE public.cargas_camion ADD CONSTRAINT cargas_camion_estado_check CHECK (estado IN ('en_ruta','pendiente_liquidacion','cerrada'));
ALTER TABLE public.cargas_camion ADD COLUMN IF NOT EXISTS finalizada_en timestamptz, ADD COLUMN IF NOT EXISTS finalizada_por uuid, ADD COLUMN IF NOT EXISTS nota_finalizacion text;

CREATE OR REPLACE FUNCTION public.finalizar_ruta_carga(p_carga uuid, p_nota text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE org uuid:=public.current_organization_id(); uid uuid:=auth.uid(); c public.cargas_camion;
BEGIN
 IF uid IS NULL OR org IS NULL OR NOT public.is_staff(uid) THEN RAISE EXCEPTION 'No autorizado'; END IF;
 SELECT * INTO c FROM cargas_camion WHERE id=p_carga AND organization_id=org FOR UPDATE;
 IF NOT FOUND OR (c.vendedor_id<>uid AND NOT public.is_admin(uid)) THEN RAISE EXCEPTION 'No autorizado para este camión'; END IF;
 IF c.estado='pendiente_liquidacion' THEN RETURN; END IF;
 IF c.estado<>'en_ruta' THEN RAISE EXCEPTION 'Esta carga ya está cerrada'; END IF;
 UPDATE cargas_camion SET estado='pendiente_liquidacion', finalizada_en=now(), finalizada_por=uid, nota_finalizacion=NULLIF(btrim(p_nota),''), updated_at=now() WHERE id=p_carga;
 INSERT INTO auditoria(organization_id,usuario_id,accion,entidad,detalle) VALUES(org,uid,'finalizar_ruta','cargas_camion',jsonb_build_object('carga_id',p_carga,'nota',p_nota));
END $$;

CREATE OR REPLACE FUNCTION public.reabrir_ruta_carga(p_carga uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE org uuid:=public.current_organization_id(); uid uuid:=auth.uid(); c public.cargas_camion;
BEGIN
 IF uid IS NULL OR org IS NULL OR NOT public.is_admin(uid) THEN RAISE EXCEPTION 'Solo un administrador puede reabrir la ruta'; END IF;
 IF NULLIF(btrim(p_motivo),'') IS NULL THEN RAISE EXCEPTION 'Indique el motivo de la reapertura'; END IF;
 SELECT * INTO c FROM cargas_camion WHERE id=p_carga AND organization_id=org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Carga no encontrada'; END IF;
 IF c.estado<>'pendiente_liquidacion' THEN RAISE EXCEPTION 'Solo se pueden reabrir rutas pendientes de liquidación'; END IF;
 UPDATE cargas_camion SET estado='en_ruta', finalizada_en=NULL, finalizada_por=NULL, updated_at=now(),
   notas=concat_ws(E'\n',notas,'Ruta reabierta: '||btrim(p_motivo)) WHERE id=p_carga;
 INSERT INTO auditoria(organization_id,usuario_id,accion,entidad,detalle) VALUES(org,uid,'reabrir_ruta','cargas_camion',jsonb_build_object('carga_id',p_carga,'motivo',p_motivo,'finalizada_en',c.finalizada_en,'finalizada_por',c.finalizada_por,'nota_finalizacion',c.nota_finalizacion));
END $$;
REVOKE ALL ON FUNCTION public.finalizar_ruta_carga(uuid,text), public.reabrir_ruta_carga(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalizar_ruta_carga(uuid,text), public.reabrir_ruta_carga(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cierre_global_ruta(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE org uuid:=public.current_organization_id(); uid uuid:=auth.uid(); cid uuid:=(p->>'carga_id')::uuid; c public.cargas_camion;
 vid uuid:=gen_random_uuid(); crid uuid; r record; it jsonb; disp numeric; sob numeric; mer numeric; vend numeric; precio numeric;
 total_v numeric:=0; contado numeric:=COALESCE((p->>'contado')::numeric,0); cred numeric:=COALESCE((p->>'credito')::numeric,0); mermas jsonb:='[]'; cierre uuid;
BEGIN
 IF uid IS NULL OR org IS NULL OR NOT public.is_admin(uid) THEN RAISE EXCEPTION 'Solo administradores pueden cerrar la ruta'; END IF;
 IF contado<0 OR cred<0 THEN RAISE EXCEPTION 'Montos inválidos'; END IF;
 SELECT * INTO c FROM cargas_camion WHERE id=cid AND organization_id=org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Carga no encontrada'; END IF;
 IF c.estado NOT IN ('en_ruta','pendiente_liquidacion') THEN RAISE EXCEPTION 'Esta carga ya está cerrada'; END IF;
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
END $function$;