CREATE TABLE public.pos_cajas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL DEFAULT public.current_organization_id() REFERENCES public.organizations(id), usuario_id uuid NOT NULL DEFAULT auth.uid(), nombre text NOT NULL, modalidad text NOT NULL DEFAULT 'local', carga_id uuid REFERENCES public.cargas_camion(id), lista_id uuid REFERENCES public.listas_precios(id), apertura timestamptz NOT NULL DEFAULT now(), cierre timestamptz, fondo numeric NOT NULL DEFAULT 0, efectivo_contado numeric, diferencia numeric, estado text NOT NULL DEFAULT 'abierta'
);
GRANT SELECT ON public.pos_cajas TO authenticated;
GRANT ALL ON public.pos_cajas TO service_role;
ALTER TABLE public.pos_cajas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pos empresa" ON public.pos_cajas AS RESTRICTIVE FOR ALL TO authenticated USING (organization_id=public.current_organization_id()) WITH CHECK (organization_id=public.current_organization_id());
CREATE POLICY "Pos leer" ON public.pos_cajas FOR SELECT TO authenticated USING (usuario_id=auth.uid() OR public.is_admin(auth.uid()));
CREATE UNIQUE INDEX pos_caja_usuario_abierta ON public.pos_cajas(organization_id,usuario_id) WHERE estado='abierta';
ALTER TABLE public.ventas ADD COLUMN pos_caja_id uuid REFERENCES public.pos_cajas(id), ADD COLUMN pos_datos jsonb;
CREATE INDEX ventas_pos_caja_idx ON public.ventas(pos_caja_id);
CREATE OR REPLACE FUNCTION public.pos_abrir_caja(p jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid:=public.current_organization_id(); uid uuid:=auth.uid(); cid uuid:=NULLIF(p->>'carga_id','')::uuid; lid uuid:=NULLIF(p->>'lista_id','')::uuid; sid uuid;
BEGIN
 IF uid IS NULL OR org IS NULL OR NOT (public.has_role(uid,'vendedor') OR public.is_admin(uid)) THEN RAISE EXCEPTION 'No autorizado para operar caja'; END IF;
 IF length(trim(COALESCE(p->>'nombre','')))=0 OR COALESCE((p->>'fondo')::numeric,0)<0 OR p->>'modalidad' NOT IN ('feria','local') THEN RAISE EXCEPTION 'Datos de apertura inválidos'; END IF;
 IF cid IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM cargas_camion WHERE id=cid AND organization_id=org AND estado='en_ruta' AND (vendedor_id=uid OR public.is_admin(uid))) THEN RAISE EXCEPTION 'Carga no disponible'; END IF;
 ELSE
  IF lid IS NULL OR NOT EXISTS(SELECT 1 FROM listas_precios WHERE id=lid AND organization_id=org AND activo AND (fecha_inicio IS NULL OR fecha_inicio<=CURRENT_DATE) AND (fecha_fin IS NULL OR fecha_fin>=CURRENT_DATE)) THEN RAISE EXCEPTION 'Seleccione una lista de precios vigente'; END IF;
 END IF;
 INSERT INTO pos_cajas(organization_id,usuario_id,nombre,modalidad,carga_id,lista_id,fondo) VALUES(org,uid,trim(p->>'nombre'),p->>'modalidad',cid,lid,COALESCE((p->>'fondo')::numeric,0)) RETURNING id INTO sid;
 RETURN sid;
END $$;
REVOKE ALL ON FUNCTION public.pos_abrir_caja(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_abrir_caja(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.pos_registrar_venta(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid:=public.current_organization_id(); uid uuid:=auth.uid(); sid uuid:=(p->>'id')::uuid; caja public.pos_cajas; v public.ventas; cliente uuid:=NULLIF(p->>'cliente_id','')::uuid; receptor jsonb:=COALESCE(p->'pos'->'receptor','{}'); tipo text:=COALESCE(p->'pos'->>'documento','interno'); medio text:=COALESCE(p->'pos'->>'medio','efectivo'); sub numeric:=0; esperado numeric; r record; pr public.productos; ruta uuid; lid uuid; n integer; monto numeric; recibido numeric; datos jsonb;
BEGIN
 IF uid IS NULL OR org IS NULL OR NOT (public.has_role(uid,'vendedor') OR public.is_admin(uid)) THEN RAISE EXCEPTION 'No autorizado para vender'; END IF;
 SELECT * INTO caja FROM pos_cajas WHERE id=(p->'pos'->>'caja_id')::uuid AND organization_id=org FOR UPDATE;
 IF NOT FOUND OR caja.usuario_id<>uid THEN RAISE EXCEPTION 'Caja no autorizada'; END IF;
 SELECT * INTO v FROM ventas WHERE id=sid;
 IF FOUND THEN IF v.organization_id<>org OR v.pos_caja_id IS DISTINCT FROM caja.id THEN RAISE EXCEPTION 'Venta pertenece a otra caja'; END IF; RETURN to_jsonb(v); END IF;
 IF caja.estado<>'abierta' THEN RAISE EXCEPTION 'La caja está cerrada'; END IF;
 IF tipo NOT IN ('interno','nombre','electronica') OR medio NOT IN ('efectivo','tarjeta','sinpe') THEN RAISE EXCEPTION 'Documento o pago inválido'; END IF;
 IF tipo<>'interno' AND length(trim(COALESCE(receptor->>'nombre','')))=0 THEN RAISE EXCEPTION 'Indique el nombre del cliente'; END IF;
 IF tipo='electronica' THEN RAISE EXCEPTION 'La conexión con Hacienda aún no está habilitada; emita un comprobante interno'; END IF;
 IF COALESCE(p->'pos'->>'correo','')<>'' AND p->'pos'->>'correo' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Correo inválido'; END IF;
 IF cliente IS NOT NULL AND NOT EXISTS(SELECT 1 FROM clientes WHERE id=cliente AND organization_id=org AND activo) THEN RAISE EXCEPTION 'Cliente inválido'; END IF;
 IF p->>'metodo'<>'contado' OR COALESCE((p->>'descuento')::numeric,0)<>0 OR jsonb_typeof(p->'items') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Venta inválida'; END IF;
 IF jsonb_array_length(p->'items')=0 THEN RAISE EXCEPTION 'Agregue productos'; END IF;
 IF caja.carga_id IS NOT NULL THEN SELECT ruta_id,lista_precio_id INTO ruta,lid FROM rutas WHERE id=(SELECT ruta_id FROM cargas_camion WHERE id=caja.carga_id AND organization_id=org); ELSE lid:=caja.lista_id; END IF;
 FOR r IN SELECT (x->>'producto_id')::uuid AS pid, sum((x->>'cantidad')::numeric) AS cantidad FROM jsonb_array_elements(p->'items') x GROUP BY 1 ORDER BY 1 LOOP
  SELECT * INTO pr FROM productos WHERE id=r.pid AND organization_id=org AND activo FOR UPDATE;
  IF NOT FOUND OR r.cantidad<=0 OR r.cantidad::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Producto o cantidad inválidos'; END IF;
  IF caja.carga_id IS NULL AND pr.existencia<r.cantidad THEN RAISE EXCEPTION 'Existencia insuficiente: %',pr.nombre; END IF;
  esperado:=NULL;
  IF cliente IS NOT NULL THEN
   SELECT count(*),min(precio) INTO n,monto FROM precios_especiales WHERE organization_id=org AND cliente_id=cliente AND producto_id=r.pid AND activo AND fecha_inicio<=CURRENT_DATE AND (fecha_fin IS NULL OR fecha_fin>=CURRENT_DATE) AND ruta_id IS NOT DISTINCT FROM ruta;
   IF n>1 THEN RAISE EXCEPTION 'Precios especiales contradictorios'; END IF; IF n=1 THEN esperado:=monto; END IF;
   IF esperado IS NULL AND ruta IS NOT NULL THEN
    SELECT count(*),min(precio) INTO n,monto FROM precios_especiales WHERE organization_id=org AND cliente_id=cliente AND producto_id=r.pid AND activo AND fecha_inicio<=CURRENT_DATE AND (fecha_fin IS NULL OR fecha_fin>=CURRENT_DATE) AND ruta_id IS NULL;
    IF n>1 THEN RAISE EXCEPTION 'Precios especiales contradictorios'; END IF; IF n=1 THEN esperado:=monto; END IF;
   END IF;
  END IF;
  IF esperado IS NULL THEN SELECT pp.precio INTO esperado FROM precios_productos pp JOIN listas_precios lp ON lp.id=pp.lista_id WHERE pp.organization_id=org AND pp.lista_id=lid AND pp.producto_id=r.pid AND lp.activo AND (lp.fecha_inicio IS NULL OR lp.fecha_inicio<=CURRENT_DATE) AND (lp.fecha_fin IS NULL OR lp.fecha_fin>=CURRENT_DATE); END IF;
  IF esperado IS NULL OR esperado<0 THEN RAISE EXCEPTION 'Sin precio vigente: %',pr.nombre; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p->'items') x WHERE (x->>'producto_id')::uuid=r.pid AND ((x->>'precio')::numeric IS DISTINCT FROM esperado OR x->>'nombre' IS DISTINCT FROM pr.nombre OR (x->>'cantidad')::numeric<=0 OR (x->>'cantidad')::numeric::text IN ('NaN','Infinity','-Infinity'))) THEN RAISE EXCEPTION 'Precio cambió o línea inválida; revise el carrito'; END IF;
  sub:=sub+esperado*r.cantidad;
 END LOOP;
 recibido:=COALESCE((p->'pos'->>'recibido')::numeric,sub);
 IF recibido::text IN ('NaN','Infinity','-Infinity') OR (medio='efectivo' AND recibido<sub) THEN RAISE EXCEPTION 'El efectivo recibido es insuficiente'; END IF;
 datos:=p->'pos'||jsonb_build_object('medio',medio,'recibido',CASE WHEN medio='efectivo' THEN recibido ELSE sub END,'vuelto',CASE WHEN medio='efectivo' THEN recibido-sub ELSE 0 END,'estado_fiscal','no_emitido','estado_correo',CASE WHEN COALESCE(p->'pos'->>'correo','')='' THEN 'no_solicitado' ELSE 'pendiente_configuracion' END);
 IF caja.carga_id IS NOT NULL THEN
  IF cliente IS NULL THEN
   INSERT INTO clientes(organization_id,nombre,activo) VALUES(org,'Consumidor final · Mostrador',true) RETURNING id INTO cliente;
  END IF;
  PERFORM public.vender_desde_camion(p||jsonb_build_object('cliente_id',cliente,'carga_id',caja.carga_id,'ruta_id',ruta,'vendedor_id',uid));
  UPDATE ventas SET cliente_id=NULLIF(p->>'cliente_id','')::uuid,pos_caja_id=caja.id,pos_datos=datos WHERE id=sid RETURNING * INTO v;
 ELSE
  INSERT INTO ventas(id,organization_id,cliente_id,vendedor_id,subtotal,descuento,total,metodo_pago,pos_caja_id,pos_datos) VALUES(sid,org,cliente,uid,sub,0,sub,'contado',caja.id,datos) RETURNING * INTO v;
  INSERT INTO detalle_ventas(organization_id,venta_id,producto_id,nombre_producto,cantidad,precio_unitario,total_linea) SELECT org,sid,(x->>'producto_id')::uuid,x->>'nombre',(x->>'cantidad')::numeric,(x->>'precio')::numeric,(x->>'cantidad')::numeric*(x->>'precio')::numeric FROM jsonb_array_elements(p->'items') x;
  FOR r IN SELECT (x->>'producto_id')::uuid AS pid,sum((x->>'cantidad')::numeric) AS cantidad FROM jsonb_array_elements(p->'items') x GROUP BY 1 LOOP
   UPDATE productos SET existencia=existencia-r.cantidad WHERE id=r.pid;
   INSERT INTO movimientos_inventario(organization_id,producto_id,tipo,cantidad,motivo,usuario_id) VALUES(org,r.pid,'salida',r.cantidad,'Venta POS '||sid,uid);
  END LOOP;
 END IF;
 INSERT INTO auditoria(organization_id,usuario_id,accion,entidad,detalle) VALUES(org,uid,'venta_pos','ventas',jsonb_build_object('venta_id',sid,'caja_id',caja.id,'total',sub));
 RETURN to_jsonb(v);
END $$;
REVOKE ALL ON FUNCTION public.pos_registrar_venta(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_registrar_venta(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.pos_cerrar_caja(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid:=public.current_organization_id(); uid uuid:=auth.uid(); c public.pos_cajas; esperado numeric; contado numeric:=(p->>'contado')::numeric;
BEGIN
 SELECT * INTO c FROM pos_cajas WHERE id=(p->>'id')::uuid AND organization_id=org FOR UPDATE;
 IF uid IS NULL OR NOT FOUND OR c.usuario_id<>uid OR NOT (public.is_admin(uid) OR public.has_role(uid,'vendedor')) THEN RAISE EXCEPTION 'Caja no autorizada'; END IF;
 IF c.estado<>'abierta' OR contado<0 OR contado IS NULL OR contado::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Cierre inválido'; END IF;
 SELECT c.fondo+COALESCE(sum(total) FILTER(WHERE pos_datos->>'medio'='efectivo'),0) INTO esperado FROM ventas WHERE pos_caja_id=c.id AND organization_id=org;
 UPDATE pos_cajas SET cierre=now(),estado='cerrada',efectivo_contado=contado,diferencia=contado-esperado WHERE id=c.id RETURNING * INTO c;
 RETURN to_jsonb(c);
END $$;
REVOKE ALL ON FUNCTION public.pos_cerrar_caja(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_cerrar_caja(jsonb) TO authenticated;
