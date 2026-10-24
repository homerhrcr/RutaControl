CREATE OR REPLACE FUNCTION public.admin_editar_credito(p_id uuid, p_monto numeric, p_fecha date, p_fecha_limite date, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.creditos; v_abonado numeric; v_monto numeric;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Solo administradores pueden editar créditos'; END IF;
  IF coalesce(trim(p_motivo),'') = '' THEN RAISE EXCEPTION 'Indica el motivo del cambio'; END IF;
  SELECT * INTO c FROM public.creditos WHERE id = p_id AND organization_id = public.current_organization_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Crédito no encontrado'; END IF;
  SELECT coalesce(sum(monto),0) INTO v_abonado FROM public.abonos WHERE credito_id = p_id;
  v_monto := c.monto;
  IF c.venta_id IS NULL THEN
    IF p_monto IS NULL OR p_monto <= 0 THEN RAISE EXCEPTION 'El monto debe ser mayor a cero'; END IF;
    IF p_monto < v_abonado THEN RAISE EXCEPTION 'El monto no puede ser menor a lo ya abonado (%)', v_abonado; END IF;
    IF p_fecha IS NULL OR p_fecha > (now() AT TIME ZONE 'America/Costa_Rica')::date THEN RAISE EXCEPTION 'La fecha no puede ser futura'; END IF;
    v_monto := p_monto;
  END IF;
  UPDATE public.creditos SET
    monto = v_monto,
    saldo = v_monto - v_abonado,
    fecha = CASE WHEN c.venta_id IS NULL THEN (p_fecha::text || 'T12:00:00-06:00')::timestamptz ELSE fecha END,
    fecha_limite = p_fecha_limite,
    estado = CASE WHEN v_monto - v_abonado <= 0 THEN 'cancelado'::estado_credito ELSE estado END,
    updated_at = now()
  WHERE id = p_id;
  INSERT INTO public.auditoria(usuario_id, accion, entidad, detalle)
  VALUES (auth.uid(), 'editar_credito', 'creditos', jsonb_build_object('credito_id', p_id, 'motivo', p_motivo,
    'antes', jsonb_build_object('monto', c.monto, 'saldo', c.saldo, 'fecha', c.fecha, 'fecha_limite', c.fecha_limite),
    'despues', jsonb_build_object('monto', v_monto, 'saldo', v_monto - v_abonado, 'fecha_limite', p_fecha_limite)));
END $$;

CREATE OR REPLACE FUNCTION public.admin_eliminar_credito(p_id uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.creditos;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Solo administradores pueden borrar créditos'; END IF;
  IF coalesce(trim(p_motivo),'') = '' THEN RAISE EXCEPTION 'Indica el motivo'; END IF;
  SELECT * INTO c FROM public.creditos WHERE id = p_id AND organization_id = public.current_organization_id() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Crédito no encontrado'; END IF;
  IF c.venta_id IS NOT NULL THEN RAISE EXCEPTION 'Este crédito viene de una venta; anule la venta en lugar de borrarlo'; END IF;
  IF EXISTS (SELECT 1 FROM public.abonos WHERE credito_id = p_id) THEN RAISE EXCEPTION 'No se puede borrar: el crédito ya tiene abonos'; END IF;
  IF EXISTS (SELECT 1 FROM public.cierres_ruta WHERE credito_id = p_id) THEN RAISE EXCEPTION 'Este crédito pertenece a un cierre de ruta y no se puede borrar'; END IF;
  DELETE FROM public.creditos WHERE id = p_id;
  INSERT INTO public.auditoria(usuario_id, accion, entidad, detalle)
  VALUES (auth.uid(), 'eliminar_credito', 'creditos', jsonb_build_object('credito_id', p_id, 'motivo', p_motivo, 'cliente_id', c.cliente_id, 'monto', c.monto, 'saldo', c.saldo, 'fecha', c.fecha));
END $$;

REVOKE ALL ON FUNCTION public.admin_editar_credito(uuid, numeric, date, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_eliminar_credito(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_editar_credito(uuid, numeric, date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_eliminar_credito(uuid, text) TO authenticated;