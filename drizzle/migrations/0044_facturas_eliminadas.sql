CREATE TABLE public.facturas_eliminadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_organization_id() REFERENCES public.organizations(id),
  venta_id uuid NOT NULL,
  fecha_venta timestamptz,
  cliente_id uuid,
  cliente_nombre text,
  ruta_id uuid,
  ruta_nombre text,
  total numeric NOT NULL DEFAULT 0,
  metodo_pago text,
  datos jsonb NOT NULL,
  motivo text NOT NULL,
  eliminada_por uuid,
  eliminada_por_nombre text,
  eliminada_en timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.facturas_eliminadas TO authenticated;
GRANT ALL ON public.facturas_eliminadas TO service_role;
ALTER TABLE public.facturas_eliminadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins ven facturas eliminadas" ON public.facturas_eliminadas FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id() AND public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.eliminar_factura(p_venta uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE org uuid := public.current_organization_id(); v public.ventas; c public.cargas_camion; r record; snap jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Solo administradores pueden eliminar facturas'; END IF;
  IF coalesce(btrim(p_motivo),'') = '' THEN RAISE EXCEPTION 'Debe indicar el motivo'; END IF;
  SELECT * INTO v FROM ventas WHERE id = p_venta AND organization_id = org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Factura no encontrada'; END IF;
  IF EXISTS (SELECT 1 FROM cierres_ruta WHERE venta_id = p_venta OR credito_id IN (SELECT id FROM creditos WHERE venta_id = p_venta)) THEN
    RAISE EXCEPTION 'Esta venta pertenece a un cierre global de ruta y no se puede eliminar';
  END IF;

  snap := jsonb_build_object(
    'venta', to_jsonb(v),
    'detalle', coalesce((SELECT jsonb_agg(to_jsonb(d)) FROM detalle_ventas d WHERE d.venta_id = p_venta), '[]'::jsonb),
    'creditos', coalesce((SELECT jsonb_agg(to_jsonb(cr) || jsonb_build_object('abonos', coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM abonos a WHERE a.credito_id = cr.id), '[]'::jsonb))) FROM creditos cr WHERE cr.venta_id = p_venta), '[]'::jsonb)
  );

  INSERT INTO facturas_eliminadas(organization_id, venta_id, fecha_venta, cliente_id, cliente_nombre, ruta_id, ruta_nombre, total, metodo_pago, datos, motivo, eliminada_por, eliminada_por_nombre)
  VALUES (org, v.id, v.fecha, v.cliente_id, (SELECT nombre FROM clientes WHERE id = v.cliente_id), v.ruta_id, (SELECT nombre FROM rutas WHERE id = v.ruta_id),
    v.total, v.metodo_pago::text, snap, btrim(p_motivo), auth.uid(), (SELECT nombre FROM profiles WHERE id = auth.uid()));

  IF v.carga_id IS NOT NULL THEN
    SELECT * INTO c FROM cargas_camion WHERE id = v.carga_id AND organization_id = org FOR UPDATE;
  END IF;

  IF c.id IS NOT NULL AND c.estado IN ('en_ruta','pendiente_liquidacion') THEN
    FOR r IN SELECT producto_id, sum(cantidad) AS cantidad FROM detalle_ventas WHERE venta_id = p_venta AND producto_id IS NOT NULL GROUP BY producto_id LOOP
      UPDATE cargas_camion_detalle SET vendido = greatest(0, vendido - r.cantidad) WHERE carga_id = c.id AND producto_id = r.producto_id;
    END LOOP;
    UPDATE cargas_camion SET updated_at = now() WHERE id = c.id;
  ELSE
    FOR r IN SELECT producto_id, sum(cantidad) AS cantidad FROM detalle_ventas WHERE venta_id = p_venta AND producto_id IS NOT NULL GROUP BY producto_id LOOP
      UPDATE productos SET existencia = existencia + r.cantidad WHERE id = r.producto_id AND organization_id = org;
      INSERT INTO movimientos_inventario(organization_id, producto_id, tipo, cantidad, motivo, usuario_id)
      VALUES (org, r.producto_id, 'entrada', r.cantidad, 'Factura eliminada: ' || btrim(p_motivo), auth.uid());
    END LOOP;
  END IF;

  UPDATE pedidos SET estado = CASE WHEN carga_id IS NOT NULL THEN 'cargado' ELSE 'pendiente' END, venta_id = NULL WHERE venta_id = p_venta;
  DELETE FROM ventas WHERE id = p_venta;

  INSERT INTO auditoria(organization_id, usuario_id, accion, entidad, detalle)
  VALUES (org, auth.uid(), 'eliminar_factura', 'ventas', jsonb_build_object('venta_id', p_venta, 'motivo', btrim(p_motivo), 'total', v.total));
END $$;
REVOKE ALL ON FUNCTION public.eliminar_factura(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.eliminar_factura(uuid, text) TO authenticated;