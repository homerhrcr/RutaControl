CREATE OR REPLACE FUNCTION public.trg_pedido_asignar_carga_activa() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid;
BEGIN
  IF NEW.carga_id IS NULL AND NEW.ruta_id IS NOT NULL AND NEW.estado NOT IN ('entregado','anulado','cancelado') THEN
    SELECT id INTO cid FROM cargas_camion
     WHERE organization_id = NEW.organization_id AND ruta_id = NEW.ruta_id AND estado = 'en_ruta'
     ORDER BY created_at DESC LIMIT 1;
    IF cid IS NOT NULL THEN
      NEW.carga_id := cid;
      IF NEW.estado IN ('confirmado','borrador') THEN NEW.estado := 'cargado'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS pedido_asignar_carga_activa ON public.pedidos;
CREATE TRIGGER pedido_asignar_carga_activa BEFORE INSERT ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.trg_pedido_asignar_carga_activa();

UPDATE public.pedidos p SET carga_id = c.id, estado = 'cargado'
FROM public.cargas_camion c
WHERE p.carga_id IS NULL AND p.ruta_id = c.ruta_id AND p.organization_id = c.organization_id
  AND c.estado = 'en_ruta' AND p.estado IN ('confirmado','borrador');