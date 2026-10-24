DO $ddl$
DECLARE d text;
BEGIN
 SELECT pg_get_functiondef('public.pos_abrir_caja(jsonb)'::regprocedure) INTO d;
 d:=replace(d,'IF length(trim(COALESCE(p->>''nombre'','''')))=0', 'IF COALESCE((p->>''fondo'')::numeric,0)::text IN (''NaN'',''Infinity'',''-Infinity'') OR p->>''modalidad'' IS NULL OR length(trim(COALESCE(p->>''nombre'','''')))=0');
 EXECUTE d;
 SELECT pg_get_functiondef('public.pos_registrar_venta(jsonb)'::regprocedure) INTO d;
 d:=replace(d, 'IF tipo NOT IN', 'IF tipo IS NULL OR medio IS NULL OR tipo NOT IN');
 d:=replace(d,'IF p->>''metodo''<>''contado''', 'IF p->>''metodo'' IS DISTINCT FROM ''contado''');
 d:=replace(d, 'IF NOT FOUND OR r.cantidad<=0', 'IF NOT FOUND OR r.cantidad IS NULL OR r.cantidad<=0');
 d:=replace(d, '(x->>''cantidad'')::numeric<=0 OR', '(x->>''cantidad'') IS NULL OR (x->>''cantidad'')::numeric<=0 OR');
 d:=replace(d,'IF esperado IS NULL OR esperado<0', 'IF esperado IS NULL OR esperado::text IN (''NaN'',''Infinity'',''-Infinity'') OR esperado<0');
 d:=replace(d,'recibido:=COALESCE', 'sub:=round(sub,2); recibido:=COALESCE');
 d:=replace(d,'SELECT * INTO caja FROM pos_cajas', 'IF p->''pos''->>''organization_id'' IS DISTINCT FROM org::text THEN RAISE EXCEPTION ''La empresa no coincide con la venta''; END IF; SELECT * INTO caja FROM pos_cajas');
 EXECUTE d;
END $ddl$;