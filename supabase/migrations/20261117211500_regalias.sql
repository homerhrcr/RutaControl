ALTER TABLE public.detalle_ventas ADD COLUMN IF NOT EXISTS es_regalia boolean NOT NULL DEFAULT false;
ALTER TABLE public.cargas_camion_detalle ADD COLUMN IF NOT EXISTS regalia numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.trg_detalle_regalia_marcar() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.precio_unitario = 0 AND NEW.precio_modificado AND NEW.motivo_modificacion ILIKE 'Regalía:%' THEN
    IF length(trim(substr(NEW.motivo_modificacion, 9))) = 0 THEN RAISE EXCEPTION 'La regalía requiere un motivo'; END IF;
    NEW.es_regalia := true;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.trg_detalle_regalia_carga() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE cid uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.es_regalia THEN
      SELECT carga_id INTO cid FROM ventas WHERE id = NEW.venta_id;
      IF cid IS NOT NULL THEN UPDATE cargas_camion_detalle SET regalia = regalia + NEW.cantidad WHERE carga_id = cid AND producto_id = NEW.producto_id; END IF;
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.es_regalia THEN
    SELECT carga_id INTO cid FROM ventas WHERE id = OLD.venta_id;
    IF cid IS NOT NULL THEN UPDATE cargas_camion_detalle SET regalia = GREATEST(0, regalia - OLD.cantidad) WHERE carga_id = cid AND producto_id = OLD.producto_id; END IF;
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS detalle_regalia_marcar ON public.detalle_ventas;
CREATE TRIGGER detalle_regalia_marcar BEFORE INSERT ON public.detalle_ventas FOR EACH ROW EXECUTE FUNCTION public.trg_detalle_regalia_marcar();
DROP TRIGGER IF EXISTS detalle_regalia_carga ON public.detalle_ventas;
CREATE TRIGGER detalle_regalia_carga AFTER INSERT OR DELETE ON public.detalle_ventas FOR EACH ROW EXECUTE FUNCTION public.trg_detalle_regalia_carga();
