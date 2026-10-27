CREATE OR REPLACE FUNCTION public.productos_orden_al_final()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.orden IS NULL OR NEW.orden <= 0 THEN
    SELECT COALESCE(MAX(orden), 0) + 1 INTO NEW.orden FROM public.productos WHERE organization_id = NEW.organization_id;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_productos_orden_al_final ON public.productos;
CREATE TRIGGER trg_productos_orden_al_final BEFORE INSERT ON public.productos
FOR EACH ROW EXECUTE FUNCTION public.productos_orden_al_final();