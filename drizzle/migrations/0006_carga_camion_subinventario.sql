CREATE TABLE public.cargas_camion (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL DEFAULT public.current_organization_id() REFERENCES public.organizations(id),
 ruta_id uuid NOT NULL REFERENCES public.rutas(id), fecha date NOT NULL DEFAULT current_date, vendedor_id uuid NOT NULL,
 vehiculo text NOT NULL DEFAULT '', notas text, estado text NOT NULL DEFAULT 'en_ruta' CHECK (estado IN ('en_ruta','cerrada')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), cerrada_en timestamptz
);
GRANT SELECT ON public.cargas_camion TO authenticated;
GRANT ALL ON public.cargas_camion TO service_role;
ALTER TABLE public.cargas_camion ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_scope ON public.cargas_camion AS RESTRICTIVE TO authenticated USING (organization_id=public.current_organization_id());
CREATE POLICY staff_read ON public.cargas_camion FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE UNIQUE INDEX carga_activa_vendedor ON public.cargas_camion(organization_id,vendedor_id,ruta_id) WHERE estado='en_ruta';
CREATE TABLE public.cargas_camion_detalle (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL DEFAULT public.current_organization_id() REFERENCES public.organizations(id),
 carga_id uuid NOT NULL REFERENCES public.cargas_camion(id), producto_id uuid NOT NULL REFERENCES public.productos(id), nombre_producto text NOT NULL,
 preventa numeric NOT NULL DEFAULT 0 CHECK (preventa>=0), extra numeric NOT NULL DEFAULT 0 CHECK (extra>=0),
 vendido numeric NOT NULL DEFAULT 0 CHECK (vendido>=0), devuelto numeric NOT NULL DEFAULT 0 CHECK (devuelto>=0), merma numeric NOT NULL DEFAULT 0 CHECK (merma>=0),
 UNIQUE(carga_id,producto_id), CHECK (vendido+devuelto+merma<=preventa+extra)
);
GRANT SELECT ON public.cargas_camion_detalle TO authenticated;
GRANT ALL ON public.cargas_camion_detalle TO service_role;
ALTER TABLE public.cargas_camion_detalle ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_scope ON public.cargas_camion_detalle AS RESTRICTIVE TO authenticated USING (organization_id=public.current_organization_id());
CREATE POLICY staff_read ON public.cargas_camion_detalle FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
ALTER TABLE public.ventas ADD COLUMN carga_id uuid REFERENCES public.cargas_camion(id);
ALTER TABLE public.pedidos ADD COLUMN carga_id uuid REFERENCES public.cargas_camion(id);
CREATE TRIGGER cargas_updated BEFORE UPDATE ON public.cargas_camion FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE FUNCTION public.abrir_carga_camion(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid:=public.current_organization_id(); uid uuid:=auth.uid(); cid uuid:=(p->>'id')::uuid; rid uuid:=(p->>'ruta_id')::uuid; vid uuid:=COALESCE((p->>'vendedor_id')::uuid,uid); f date:=(p->>'fecha')::date; r record; stock numeric; ids uuid[]; previo public.cargas_camion;
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
 IF cardinality(ids)<>(SELECT count(*) FROM pedidos WHERE id=ANY(ids) AND organization_id=org AND ruta_id=rid AND fecha_entrega=f AND estado IN ('confirmado','cargado') AND carga_id IS NULL) THEN RAISE EXCEPTION 'Un pedido cambió o ya está en otro camión'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(p->'extras','[]')) x WHERE (x->>'cantidad')::numeric<=0 OR (x->>'producto_id') IS NULL) THEN RAISE EXCEPTION 'Las cantidades extra deben ser mayores que cero'; END IF;
 INSERT INTO cargas_camion(id,organization_id,ruta_id,fecha,vendedor_id,vehiculo,notas) VALUES(cid,org,rid,f,vid,COALESCE(p->>'vehiculo',''),p->>'notas');
 FOR r IN WITH lineas AS (
 SELECT d.producto_id, d.cantidad AS preventa, 0::numeric AS extra FROM pedidos_detalle d WHERE d.pedido_id=ANY(ids) AND d.organization_id=org
 UNION ALL SELECT (x->>'producto_id')::uuid,0,(x->>'cantidad')::numeric FROM jsonb_array_elements(COALESCE(p->'extras','[]')) x
 ) SELECT producto_id,sum(preventa) AS preventa,sum(extra) AS extra FROM lineas GROUP BY producto_id ORDER BY producto_id LOOP
 IF r.preventa+r.extra<=0 THEN RAISE EXCEPTION 'Cantidad inválida'; END IF;
 SELECT existencia INTO stock FROM productos WHERE id=r.producto_id AND organization_id=org AND activo FOR UPDATE;
 IF NOT FOUND OR stock<r.preventa+r.extra THEN RAISE EXCEPTION 'Existencia insuficiente en bodega para uno de los productos'; END IF;
 INSERT INTO cargas_camion_detalle(organization_id,carga_id,producto_id,nombre_producto,preventa,extra) SELECT org,cid,id,nombre,r.preventa,r.extra FROM productos WHERE id=r.producto_id;
 UPDATE productos SET existencia=existencia-r.preventa-r.extra WHERE id=r.producto_id;
 INSERT INTO movimientos_inventario(organization_id,producto_id,tipo,cantidad,motivo,usuario_id) VALUES(org,r.producto_id,'salida',r.preventa+r.extra,'Carga de camión '||cid,uid);
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM cargas_camion_detalle WHERE carga_id=cid) THEN RAISE EXCEPTION 'Agregue pedidos o producto extra'; END IF;
 UPDATE pedidos SET carga_id=cid,estado='cargado' WHERE id=ANY(ids);
 INSERT INTO auditoria(organization_id,usuario_id,accion,entidad,detalle) VALUES(org,uid,'abrir_carga_camion','cargas_camion',jsonb_build_object('carga_id',cid));
 RETURN cid;
END $$;
REVOKE ALL ON FUNCTION public.abrir_carga_camion(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.abrir_carga_camion(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.vender_desde_camion(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid:=public.current_organization_id(); uid uuid:=auth.uid(); cid uuid:=(p->>'carga_id')::uuid; sid uuid:=(p->>'id')::uuid; cliente uuid:=(p->>'cliente_id')::uuid; c public.cargas_camion; v public.ventas; r record; disponible numeric; sub numeric; descuento numeric:=COALESCE((p->>'descuento')::numeric,0); total_v numeric; metodo public.metodo_pago:=(p->>'metodo')::public.metodo_pago;
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
 IF NOT FOUND OR disponible<r.cantidad THEN RAISE EXCEPTION 'Existencia insuficiente en el camión'; END IF;
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
CREATE OR REPLACE FUNCTION public.cerrar_carga_camion(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid:=public.current_organization_id(); uid uuid:=auth.uid(); cid uuid:=(p->>'id')::uuid; c public.cargas_camion; r record; saldo numeric; perdida numeric;
BEGIN
 IF uid IS NULL OR org IS NULL OR NOT public.is_staff(uid) THEN RAISE EXCEPTION 'No autorizado'; END IF;
 SELECT * INTO c FROM cargas_camion WHERE id=cid AND organization_id=org FOR UPDATE;
 IF NOT FOUND OR (c.vendedor_id<>uid AND NOT public.is_admin(uid)) THEN RAISE EXCEPTION 'No autorizado'; END IF;
 IF c.estado='cerrada' THEN RETURN cid; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(p->'mermas','[]')) x WHERE (x->>'cantidad')::numeric<0 OR NOT EXISTS(SELECT 1 FROM cargas_camion_detalle d WHERE d.carga_id=cid AND d.producto_id=(x->>'producto_id')::uuid)) THEN RAISE EXCEPTION 'Merma inválida'; END IF;
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
CREATE OR REPLACE FUNCTION public.anular_venta_camion(p_venta uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid:=public.current_organization_id(); v public.ventas; c public.cargas_camion; r record;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 SELECT * INTO v FROM ventas WHERE id=p_venta AND organization_id=org;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT * INTO c FROM cargas_camion WHERE id=v.carga_id AND organization_id=org FOR UPDATE;
 IF NOT FOUND OR c.estado<>'en_ruta' THEN RAISE EXCEPTION 'No se puede anular una venta de una carga cerrada'; END IF;
 FOR r IN SELECT producto_id,sum(cantidad) AS cantidad FROM detalle_ventas WHERE venta_id=p_venta GROUP BY producto_id LOOP
 UPDATE cargas_camion_detalle SET vendido=vendido-r.cantidad WHERE carga_id=c.id AND producto_id=r.producto_id;
 END LOOP;
 UPDATE pedidos SET estado='cargado',venta_id=NULL WHERE venta_id=p_venta;
 DELETE FROM ventas WHERE id=p_venta;
 UPDATE cargas_camion SET updated_at=now() WHERE id=c.id;
 INSERT INTO auditoria(organization_id,usuario_id,accion,entidad,detalle) VALUES(org,auth.uid(),'anular_venta_camion','ventas',jsonb_build_object('venta_id',p_venta,'carga_id',c.id));
END $$;
REVOKE ALL ON FUNCTION public.anular_venta_camion(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.anular_venta_camion(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.cambios_desde(p_desde timestamptz) RETURNS TABLE(entidad text,cambios bigint,ultimo timestamptz) LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT 'ventas',count(*),max(created_at) FROM ventas WHERE created_at>p_desde
 UNION ALL SELECT 'abonos',count(*),max(created_at) FROM abonos WHERE created_at>p_desde
 UNION ALL SELECT 'creditos',count(*),max(updated_at) FROM creditos WHERE updated_at>p_desde
 UNION ALL SELECT 'clientes',count(*),max(updated_at) FROM clientes WHERE updated_at>p_desde
 UNION ALL SELECT 'cliente_rutas',count(*),max(created_at) FROM cliente_rutas WHERE created_at>p_desde
 UNION ALL SELECT 'productos',count(*),max(updated_at) FROM productos WHERE updated_at>p_desde
 UNION ALL SELECT 'gastos',count(*),max(updated_at) FROM gastos WHERE updated_at>p_desde
 UNION ALL SELECT 'rutas',count(*),max(created_at) FROM rutas WHERE created_at>p_desde
 UNION ALL SELECT 'evidencias',count(*),max(created_at) FROM evidencias WHERE created_at>p_desde
 UNION ALL SELECT 'cargas_camion',count(*),max(updated_at) FROM cargas_camion WHERE updated_at>p_desde
 UNION ALL SELECT 'pedidos',count(*),max(updated_at) FROM pedidos WHERE updated_at>p_desde
$$;