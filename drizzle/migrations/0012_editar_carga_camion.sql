CREATE OR REPLACE FUNCTION public.editar_carga_camion(p jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE org uuid:=public.current_organization_id(); uid uuid:=auth.uid(); cid uuid:=(p->>'id')::uuid; c public.cargas_camion; x jsonb; pid uuid; nuevo numeric; d public.cargas_camion_detalle; reservado numeric; delta numeric;
BEGIN
 IF uid IS NULL OR org IS NULL OR NOT public.is_admin(uid) THEN RAISE EXCEPTION 'Solo un administrador puede editar la carga'; END IF;
 SELECT * INTO c FROM cargas_camion WHERE id=cid AND organization_id=org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Carga no encontrada'; END IF;
 IF c.estado<>'en_ruta' THEN RAISE EXCEPTION 'Solo se pueden editar cargas en ruta'; END IF;
 FOR x IN SELECT * FROM jsonb_array_elements(COALESCE(p->'extras','[]')) LOOP
  pid:=(x->>'producto_id')::uuid; nuevo:=(x->>'extra')::numeric;
  IF pid IS NULL OR nuevo IS NULL OR nuevo<0 THEN RAISE EXCEPTION 'Cantidades inválidas'; END IF;
  SELECT * INTO d FROM cargas_camion_detalle WHERE carga_id=cid AND producto_id=pid FOR UPDATE;
  IF NOT FOUND THEN
   CONTINUE WHEN nuevo=0;
   IF NOT EXISTS(SELECT 1 FROM productos WHERE id=pid AND organization_id=org) THEN RAISE EXCEPTION 'Producto inválido'; END IF;
   INSERT INTO cargas_camion_detalle(organization_id,carga_id,producto_id,nombre_producto,preventa,extra) SELECT org,cid,id,nombre,0,0 FROM productos WHERE id=pid RETURNING * INTO d;
  END IF;
  delta:=nuevo-d.extra;
  CONTINUE WHEN delta=0;
  SELECT COALESCE(sum(pd.cantidad),0) INTO reservado FROM pedidos_detalle pd JOIN pedidos pe ON pe.id=pd.pedido_id
   WHERE pe.carga_id=cid AND pe.estado NOT IN ('entregado','anulado') AND pd.producto_id=pid;
  IF d.preventa+nuevo-d.vendido-d.devuelto-d.merma<reservado THEN
   RAISE EXCEPTION 'No se puede bajar % por debajo de lo vendido o reservado para pedidos', d.nombre_producto;
  END IF;
  UPDATE cargas_camion_detalle SET extra=nuevo WHERE id=d.id;
  UPDATE productos SET existencia=GREATEST(0,existencia-delta) WHERE id=pid AND organization_id=org;
  INSERT INTO movimientos_inventario(organization_id,producto_id,tipo,cantidad,motivo,usuario_id)
   VALUES(org,pid,CASE WHEN delta>0 THEN 'salida' ELSE 'entrada' END::tipo_movimiento,abs(delta),'Ajuste de carga de camión '||cid,uid);
 END LOOP;
 UPDATE cargas_camion SET vehiculo=COALESCE(p->>'vehiculo',vehiculo), notas=COALESCE(p->>'notas',notas) WHERE id=cid;
 INSERT INTO auditoria(organization_id,usuario_id,accion,entidad,detalle) VALUES(org,uid,'editar_carga_camion','cargas_camion',p);
 RETURN cid;
END $function$;
REVOKE ALL ON FUNCTION public.editar_carga_camion(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.editar_carga_camion(jsonb) TO authenticated;