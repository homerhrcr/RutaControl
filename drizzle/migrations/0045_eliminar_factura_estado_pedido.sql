DO $do$ DECLARE src text; BEGIN
  SELECT pg_get_functiondef('public.eliminar_factura(uuid,text)'::regprocedure) INTO src;
  EXECUTE replace(src, 'ELSE ''pendiente'' END', 'ELSE ''confirmado'' END');
END $do$;