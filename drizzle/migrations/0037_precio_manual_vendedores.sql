CREATE OR REPLACE FUNCTION public.validar_precio_manual()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.precio_modificado THEN
    IF auth.uid() IS NOT NULL AND NOT public.is_staff(auth.uid()) THEN
      RAISE EXCEPTION 'No autorizado para modificar el precio';
    END IF;
    IF NEW.motivo_modificacion IS NULL OR btrim(NEW.motivo_modificacion) = '' THEN
      RAISE EXCEPTION 'Debe indicar el motivo del cambio de precio';
    END IF;
    NEW.modificado_por := COALESCE(NEW.modificado_por, auth.uid());
    NEW.modificado_en := COALESCE(NEW.modificado_en, now());
  END IF;
  RETURN NEW;
END;
$function$;

DO $mig$
DECLARE
  def text;
  old_ins text := 'INSERT INTO detalle_ventas(organization_id,venta_id,producto_id,nombre_producto,cantidad,precio_unitario,total_linea) SELECT org,sid,(x->>''producto_id'')::uuid,x->>''nombre'',(x->>''cantidad'')::numeric,(x->>''precio'')::numeric,(x->>''cantidad'')::numeric*(x->>''precio'')::numeric FROM jsonb_array_elements(p->''items'') x;';
  new_ins text := 'INSERT INTO detalle_ventas(organization_id,venta_id,producto_id,nombre_producto,cantidad,precio_unitario,total_linea,precio_original,precio_modificado,motivo_modificacion,modificado_por,modificado_en) SELECT org,sid,(x->>''producto_id'')::uuid,x->>''nombre'',(x->>''cantidad'')::numeric,(x->>''precio'')::numeric,(x->>''cantidad'')::numeric*(x->>''precio'')::numeric, CASE WHEN (x->>''precioModificado'')::boolean IS TRUE THEN (x->>''precioOriginal'')::numeric END, COALESCE((x->>''precioModificado'')::boolean,false), CASE WHEN (x->>''precioModificado'')::boolean IS TRUE THEN x->>''motivoModificacion'' END, CASE WHEN (x->>''precioModificado'')::boolean IS TRUE THEN uid END, CASE WHEN (x->>''precioModificado'')::boolean IS TRUE THEN now() END FROM jsonb_array_elements(p->''items'') x;';
  old_chk text := '((x->>''precio'')::numeric IS DISTINCT FROM esperado OR';
  new_chk text := '(((x->>''precio'')::numeric IS DISTINCT FROM esperado AND NOT ((x->>''precioModificado'')::boolean IS TRUE AND btrim(COALESCE(x->>''motivoModificacion'',''''))<>'''' AND (x->>''precio'')::numeric>=0)) OR';
BEGIN
  def := pg_get_functiondef('public.vender_desde_camion'::regproc);
  IF position(old_ins in def)=0 THEN RAISE EXCEPTION 'vender_desde_camion: patrón no encontrado'; END IF;
  EXECUTE replace(def, old_ins, new_ins);

  def := pg_get_functiondef('public.pos_registrar_venta'::regproc);
  IF position(old_ins in def)=0 OR position(old_chk in def)=0 THEN RAISE EXCEPTION 'pos_registrar_venta: patrón no encontrado'; END IF;
  IF position('uid' in def)=0 THEN RAISE EXCEPTION 'pos: sin uid'; END IF;
  EXECUTE replace(replace(def, old_ins, new_ins), old_chk, new_chk);
END
$mig$;