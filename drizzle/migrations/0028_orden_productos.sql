ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS orden integer NOT NULL DEFAULT 0;
WITH o AS (SELECT id, row_number() OVER (PARTITION BY organization_id ORDER BY nombre) rn FROM public.productos)
UPDATE public.productos p SET orden = o.rn FROM o WHERE o.id = p.id;
CREATE OR REPLACE FUNCTION public.guardar_orden_productos(p_items jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_org uuid := public.current_organization_id(); v_n integer := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Solo administradores pueden ordenar productos'; END IF;
  UPDATE public.productos p SET orden = (item->>'orden')::integer
  FROM jsonb_array_elements(p_items) item
  WHERE p.id = (item->>'id')::uuid AND p.organization_id = v_org;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END; $$;
REVOKE ALL ON FUNCTION public.guardar_orden_productos(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_orden_productos(jsonb) TO authenticated;