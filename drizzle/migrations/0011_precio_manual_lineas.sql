ALTER TABLE public.detalle_ventas ADD COLUMN precio_original numeric;
ALTER TABLE public.detalle_ventas ADD COLUMN precio_modificado boolean NOT NULL DEFAULT false;
ALTER TABLE public.detalle_ventas ADD COLUMN modificado_por uuid;
ALTER TABLE public.detalle_ventas ADD COLUMN modificado_en timestamptz;
ALTER TABLE public.detalle_ventas ADD COLUMN motivo_modificacion text;

CREATE OR REPLACE FUNCTION public.validar_precio_manual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.precio_modificado AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Solo un administrador puede modificar manualmente el precio de una linea de venta';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_precio_manual
BEFORE INSERT OR UPDATE ON public.detalle_ventas
FOR EACH ROW EXECUTE FUNCTION public.validar_precio_manual();