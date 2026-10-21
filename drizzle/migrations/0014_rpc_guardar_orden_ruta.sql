CREATE OR REPLACE FUNCTION public.guardar_orden_ruta(p_items jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_actualizados integer := 0;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Solo el personal de la empresa puede ordenar la ruta';
  END IF;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'No hay una empresa activa seleccionada';
  END IF;

  UPDATE public.cliente_rutas cr
  SET orden = (item->>'orden')::integer
  FROM jsonb_array_elements(p_items) AS item
  WHERE cr.id = (item->>'id')::uuid
    AND cr.organization_id = v_org;

  GET DIAGNOSTICS v_actualizados = ROW_COUNT;
  RETURN v_actualizados;
END;
$$;

REVOKE ALL ON FUNCTION public.guardar_orden_ruta(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_orden_ruta(jsonb) TO authenticated;