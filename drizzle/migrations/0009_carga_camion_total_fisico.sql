UPDATE public.productos SET existencia=0 WHERE existencia<0;
ALTER TABLE public.productos ADD CONSTRAINT productos_existencia_no_negativa CHECK (existencia>=0);
CREATE OR REPLACE FUNCTION public.abrir_carga_camion(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid:=public.current_organization_id(); uid uuid:=auth.uid(); cid uuid:=(p->>'id')::uuid; rid uuid:=(p->>'ruta_id')::uuid; vid uuid:=COALESCE((p->>'vendedor_id')::uuid,uid); f date:=(p->>'fecha')::date; r record; ids uuid[]; previo public.cargas_camion;
BEGIN
 IF uid IS NULL OR org IS NULL OR NOT public.is_staff(uid) THEN RAISE EXCEPTION 'No autorizado'; END IF;
 IF vid<>uid AND NOT public.is_admin(uid) THEN RAISE EXCEPTION 'Solo un administrador puede asignar otro vendedor'; END IF;
 IF NOT EXISTS(SELECT 1 FROM organization_members WHERE user_id=vid AND organization_id=org AND estado='active' AND role IN ('administrador','vendedor')) AND NOT public.is_platform_admin(vid) THEN RAISE EXCEPTION 'Vendedor no pertenece a la empresa'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(cid::text,0));
 SELECT * INTO previo FROM cargas_camion WHERE id=cid;
 IF FOUND THEN IF previo.organization_id<>org OR (previo.vendedor_id<>uid AND NOT public.is_admin(uid)) THEN RAISE EXCEPTION 'No autorizado'; END IF; RETURN cid; END IF;
 IF f IS NULL OR NOT EXISTS(SELECT 1 FROM rutas WHERE id=rid AND organization_id=org) THEN RAISE EXCEPTION 'Seleccione ruta y fecha válidas'; END IF;
 SELECT COALESCE(array_agg(value::uuid),'{}'::uuid[]) INTO ids FROM jsonb_array_elements_text(COALESCE(p->'pedidos','[]'));
 IF cardinality(ids)<>(SELECT count(DISTINCT x) FROM unnest(ids) x) THEN RAISE EXCEPTION 'Pedidos duplicados'; END IF;
 PERFORM id FROM pedidos WHERE id=ANY(ids) ORDER BY id FOR UPDATE;
 IF cardinality(ids)<>(SELECT count(*) FROM pedidos WHERE id=ANY(ids) AND organization_id=org AND (ruta_id=rid OR ruta_id IS NULL) AND estado IN ('confirmado','cargado') AND carga_id IS NULL) THEN RAISE EXCEPTION 'Un pedido cambió o ya está en otro camión'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(p->'totales','[]')) x WHERE (x->>'cantidad')::numeric<0 OR (x->>'producto_id') IS NULL) THEN RAISE EXCEPTION 'Las cantidades no pueden ser negativas'; END IF;
 INSERT INTO cargas_camion(id,organization_id,ruta_id,fecha,vendedor_id,vehiculo,notas) VALUES(cid,org,rid,f,vid,COALESCE(p->>'vehiculo',''),p->>'notas');
 FOR r IN WITH pre AS (
   SELECT d.producto_id, sum(d.cantidad) AS preventa FROM pedidos_detalle d WHERE d.pedido_id=ANY(ids) AND d.organization_id=org GROUP BY 1
 ), tot AS (
   SELECT (x->>'producto_id')::uuid AS producto_id, sum((x->>'cantidad')::numeric) AS total FROM jsonb_array_elements(COALESCE(p->'totales','[]')) x GROUP BY 1
 ) SELECT COALESCE(pre.producto_id,tot.producto_id) AS producto_id, COALESCE(pre.preventa,0) AS preventa, COALESCE(tot.total,pre.preventa,0) AS total
   FROM pre FULL JOIN tot ON tot.producto_id=pre.producto_id ORDER BY 1 LOOP
 IF r.total<r.preventa THEN RAISE EXCEPTION 'El total cargado no cubre los pedidos de uno de los productos'; END IF;
 CONTINUE WHEN r.total<=0;
 IF NOT EXISTS(SELECT 1 FROM productos WHERE id=r.producto_id AND organization_id=org) THEN RAISE EXCEPTION 'Producto inválido'; END IF;
 INSERT INTO cargas_camion_detalle(organization_id,carga_id,producto_id,nombre_producto,preventa,extra) SELECT org,cid,id,nombre,r.preventa,r.total-r.preventa FROM productos WHERE id=r.producto_id;
 UPDATE productos SET existencia=GREATEST(0,existencia-r.total) WHERE id=r.producto_id;
 INSERT INTO movimientos_inventario(organization_id,producto_id,tipo,cantidad,motivo,usuario_id) VALUES(org,r.producto_id,'salida',r.total,'Carga de camión '||cid,uid);
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM cargas_camion_detalle WHERE carga_id=cid) THEN RAISE EXCEPTION 'Agregue pedidos o productos a cargar'; END IF;
 UPDATE pedidos SET carga_id=cid,estado='cargado' WHERE id=ANY(ids);
 INSERT INTO auditoria(organization_id,usuario_id,accion,entidad,detalle) VALUES(org,uid,'abrir_carga_camion','cargas_camion',jsonb_build_object('carga_id',cid));
 RETURN cid;
END $$;
REVOKE ALL ON FUNCTION public.abrir_carga_camion(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.abrir_carga_camion(jsonb) TO authenticated;