DO $migration$
DECLARE f record; definition text;
BEGIN
 FOR f IN SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND p.prosrc LIKE '%estado NOT IN (''entregado'',''anulado'')%'
 LOOP
  definition:=pg_get_functiondef(f.oid);
  definition:=replace(definition, 'estado NOT IN (''entregado'',''anulado'')', 'estado NOT IN (''entregado'',''anulado'',''cancelado'')');
  EXECUTE definition;
 END LOOP;
END $migration$;