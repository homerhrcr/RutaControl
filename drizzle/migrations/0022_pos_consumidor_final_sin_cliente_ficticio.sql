DO $ddl$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.vender_desde_camion(jsonb)'::regprocedure) INTO definition;
 definition:=replace(definition, 'IF NOT EXISTS(SELECT 1 FROM clientes WHERE id=cliente AND organization_id=org) THEN RAISE EXCEPTION ''Cliente inválido''; END IF;', 'IF cliente IS NULL THEN IF NOT EXISTS(SELECT 1 FROM pos_cajas WHERE id=(p->''pos''->>''caja_id'')::uuid AND organization_id=org AND usuario_id=uid AND estado=''abierta'' AND carga_id=cid) OR metodo<>''contado'' THEN RAISE EXCEPTION ''Cliente inválido''; END IF; ELSIF NOT EXISTS(SELECT 1 FROM clientes WHERE id=cliente AND organization_id=org) THEN RAISE EXCEPTION ''Cliente inválido''; END IF;');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.pos_registrar_venta(jsonb)'::regprocedure) INTO definition;
 definition:=replace(definition, E'  IF cliente IS NULL THEN\n   INSERT INTO clientes(organization_id,nombre,activo) VALUES(org,''Consumidor final · Mostrador'',true) RETURNING id INTO cliente;\n  END IF;\n', '');
 EXECUTE definition;
END $ddl$;