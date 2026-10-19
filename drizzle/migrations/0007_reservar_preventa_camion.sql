CREATE OR REPLACE FUNCTION public.vender_desde_camion(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid:=public.current_organization_id(); uid uuid:=auth.uid(); cid uuid:=(p->>'carga_id')::uuid; sid uuid:=(p->>'id')::uuid; cliente uuid:=(p->>'cliente_id')::uuid; c public.cargas_camion; v public.ventas; r record; disponible numeric; reservado numeric; sub numeric; descuento numeric:=COALESCE((p->>'descuento')::numeric,0); total_v numeric; metodo public.metodo_pago:=(p->>'metodo')::public.metodo_pago;
BEGIN
 IF uid IS NULL OR NOT public.is_staff(uid) OR org IS NULL THEN RAISE EXCEPTION 'No autorizado'; END IF;
 SELECT * INTO c FROM cargas_camion WHERE id=cid AND organization_id=org FOR UPDATE;
 IF NOT FOUND OR (c.vendedor_id<>uid AND NOT public.is_admin(uid)) THEN RAISE EXCEPTION 'No autorizado para este camión'; END IF;
 SELECT * INTO v FROM ventas WHERE id=sid;
 IF FOUND THEN IF v.organization_id<>org OR v.carga_id IS DISTINCT FROM cid THEN RAISE EXCEPTION 'Venta pertenece a otra carga'; END IF; RETURN to_jsonb(v); END IF;
 IF c.estado<>'en_ruta' THEN RAISE EXCEPTION 'Esta carga ya está cerrada'; END IF;
 IF (p->>'ruta_id')::uuid IS DISTINCT FROM c.ruta_id THEN RAISE EXCEPTION 'La ruta no coincide con el camión'; END IF;
 IF NOT EXISTS(SELECT 1 FROM clientes WHERE id=cliente AND organization_id=org) THEN RAISE EXCEPTION 'Cliente inválido'; END IF;
 IF jsonb_array_length(COALESCE(p->'items','[]'))=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p->'items') x WHERE (x->>'cantidad')::numeric<=0 OR (x->>'precio')::numeric<0 OR x->>'producto_id' IS NULL) THEN RAISE EXCEPTION 'Productos o cantidades inválidos'; END IF;
 SELECT sum((x->>'precio')::numeric*(x->>'cantidad')::numeric) INTO sub FROM jsonb_array_elements(p->'items') x;
 IF descuento<0 OR descuento>sub THEN RAISE EXCEPTION 'Descuento inválido'; END IF;
 total_v:=sub-descuento;
 FOR r IN SELECT (x->>'producto_id')::uuid AS pid,sum((x->>'cantidad')::numeric) AS cantidad FROM jsonb_array_elements(p->'items') x GROUP BY 1 ORDER BY 1 LOOP
 SELECT preventa+extra-vendido-devuelto-merma INTO disponible FROM cargas_camion_detalle WHERE carga_id=cid AND producto_id=r.pid FOR UPDATE;
 SELECT COALESCE(sum(d.cantidad),0) INTO reservado FROM pedidos_detalle d JOIN pedidos pe ON pe.id=d.pedido_id
  WHERE pe.carga_id=cid AND pe.estado NOT IN ('entregado','anulado') AND pe.id<>sid AND pe.venta_id IS DISTINCT FROM sid AND d.producto_id=r.pid;
 IF NOT FOUND OR disponible IS NULL OR disponible-reservado<r.cantidad THEN RAISE EXCEPTION 'Existencia insuficiente en el camión: parte del producto está reservado para pedidos'; END IF;
 UPDATE cargas_camion_detalle SET vendido=vendido+r.cantidad WHERE carga_id=cid AND producto_id=r.pid;
 END LOOP;
 INSERT INTO ventas(id,organization_id,cliente_id,ruta_id,vendedor_id,subtotal,descuento,total,metodo_pago,latitud,longitud,carga_id) VALUES(sid,org,cliente,c.ruta_id,c.vendedor_id,sub,descuento,total_v,metodo,(p->>'lat')::numeric,(p->>'lng')::numeric,cid) RETURNING * INTO v;
 INSERT INTO detalle_ventas(organization_id,venta_id,producto_id,nombre_producto,cantidad,precio_unitario,total_linea) SELECT org,sid,(x->>'producto_id')::uuid,x->>'nombre',(x->>'cantidad')::numeric,(x->>'precio')::numeric,(x->>'cantidad')::numeric*(x->>'precio')::numeric FROM jsonb_array_elements(p->'items') x;
 IF metodo='credito' THEN INSERT INTO creditos(organization_id,venta_id,cliente_id,monto,saldo,fecha_limite,estado) VALUES(org,sid,cliente,total_v,total_v,(p->>'fecha_limite')::date,'al_dia'); END IF;
 UPDATE cargas_camion SET updated_at=now() WHERE id=cid;
 INSERT INTO auditoria(organization_id,usuario_id,accion,entidad,detalle) VALUES(org,uid,'venta_desde_camion','ventas',jsonb_build_object('venta_id',sid,'carga_id',cid,'total',total_v));
 RETURN to_jsonb(v);
END $$;
REVOKE ALL ON FUNCTION public.vender_desde_camion(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vender_desde_camion(jsonb) TO authenticated;