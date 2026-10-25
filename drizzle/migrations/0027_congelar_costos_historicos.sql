ALTER TABLE public.cargas_camion_detalle ADD COLUMN IF NOT EXISTS costo_unitario numeric;
ALTER TABLE public.detalle_ventas ADD COLUMN IF NOT EXISTS costo_unitario numeric;

CREATE OR REPLACE FUNCTION public.costo_producto_ruta(p_producto uuid, p_ruta uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT pp.costo FROM public.rutas r JOIN public.precios_productos pp ON pp.lista_id = r.lista_precio_id AND pp.producto_id = p_producto WHERE r.id = p_ruta AND pp.costo IS NOT NULL),
    (SELECT costo FROM public.productos WHERE id = p_producto), 0)
$$;

CREATE OR REPLACE FUNCTION public.trg_costo_detalle_venta() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.costo_unitario IS NULL AND NEW.producto_id IS NOT NULL THEN
    NEW.costo_unitario := public.costo_producto_ruta(NEW.producto_id, (SELECT ruta_id FROM public.ventas WHERE id = NEW.venta_id));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS costo_detalle_venta ON public.detalle_ventas;
CREATE TRIGGER costo_detalle_venta BEFORE INSERT ON public.detalle_ventas FOR EACH ROW EXECUTE FUNCTION public.trg_costo_detalle_venta();

CREATE OR REPLACE FUNCTION public.trg_congelar_costos_carga() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.estado <> 'en_ruta' AND OLD.estado = 'en_ruta' THEN
    UPDATE public.cargas_camion_detalle SET costo_unitario = public.costo_producto_ruta(producto_id, NEW.ruta_id)
    WHERE carga_id = NEW.id AND costo_unitario IS NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS congelar_costos_carga ON public.cargas_camion;
CREATE TRIGGER congelar_costos_carga AFTER UPDATE OF estado ON public.cargas_camion FOR EACH ROW EXECUTE FUNCTION public.trg_congelar_costos_carga();

-- Recalculo único del histórico con las listas vigentes
UPDATE public.detalle_ventas d SET costo_unitario = public.costo_producto_ruta(d.producto_id, v.ruta_id)
FROM public.ventas v WHERE v.id = d.venta_id AND d.producto_id IS NOT NULL AND d.costo_unitario IS NULL;
UPDATE public.cargas_camion_detalle d SET costo_unitario = public.costo_producto_ruta(d.producto_id, c.ruta_id)
FROM public.cargas_camion c WHERE c.id = d.carga_id AND c.estado <> 'en_ruta' AND d.costo_unitario IS NULL;

CREATE OR REPLACE FUNCTION public.editar_costo_carga(p_carga uuid, p_producto uuid, p_costo numeric, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.cargas_camion; v_antes numeric;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Solo administradores pueden ajustar costos'; END IF;
  IF coalesce(trim(p_motivo),'') = '' THEN RAISE EXCEPTION 'Indica el motivo del ajuste'; END IF;
  IF p_costo IS NULL OR p_costo < 0 THEN RAISE EXCEPTION 'Costo inválido'; END IF;
  SELECT * INTO c FROM public.cargas_camion WHERE id = p_carga AND organization_id = public.current_organization_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Carga no encontrada'; END IF;
  IF c.estado = 'en_ruta' THEN RAISE EXCEPTION 'Solo se ajustan costos de cargas cerradas; las cargas en ruta usan la lista vigente'; END IF;
  SELECT costo_unitario INTO v_antes FROM public.cargas_camion_detalle WHERE carga_id = p_carga AND producto_id = p_producto;
  IF NOT FOUND THEN RAISE EXCEPTION 'Producto no está en la carga'; END IF;
  UPDATE public.cargas_camion_detalle SET costo_unitario = round(p_costo, 2) WHERE carga_id = p_carga AND producto_id = p_producto;
  UPDATE public.detalle_ventas d SET costo_unitario = round(p_costo, 2) FROM public.ventas v
    WHERE v.id = d.venta_id AND v.carga_id = p_carga AND d.producto_id = p_producto;
  INSERT INTO public.auditoria(usuario_id, accion, entidad, detalle)
  VALUES (auth.uid(), 'ajustar_costo_historico', 'cargas_camion', jsonb_build_object('carga_id', p_carga, 'producto_id', p_producto, 'antes', v_antes, 'despues', round(p_costo, 2), 'motivo', p_motivo));
END $$;
REVOKE EXECUTE ON FUNCTION public.editar_costo_carga(uuid, uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.editar_costo_carga(uuid, uuid, numeric, text) TO authenticated;