DO $mig$
DECLARE def text;
  old_s text := 'sub:=sub+esperado*r.cantidad;';
  new_s text := 'sub:=sub+(SELECT COALESCE(sum((x->>''cantidad'')::numeric*(x->>''precio'')::numeric),0) FROM jsonb_array_elements(p->''items'') x WHERE (x->>''producto_id'')::uuid=r.pid);';
BEGIN
  def := pg_get_functiondef('public.pos_registrar_venta'::regproc);
  IF position(old_s in def)=0 THEN RAISE EXCEPTION 'pos_registrar_venta: patrón no encontrado'; END IF;
  EXECUTE replace(def, old_s, new_s);
END
$mig$;