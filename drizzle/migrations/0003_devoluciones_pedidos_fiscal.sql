-- DEVOLUCIONES
CREATE TABLE public.devoluciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_organization_id() REFERENCES public.organizations(id),
  fecha timestamptz NOT NULL DEFAULT now(),
  cliente_id uuid REFERENCES public.clientes(id),
  ruta_id uuid REFERENCES public.rutas(id),
  usuario_id uuid,
  tipo text NOT NULL DEFAULT 'cliente' CHECK (tipo IN ('cliente','ruta')),
  total numeric NOT NULL DEFAULT 0,
  aplicado_credito numeric NOT NULL DEFAULT 0,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.devoluciones_detalle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_organization_id() REFERENCES public.organizations(id),
  devolucion_id uuid NOT NULL REFERENCES public.devoluciones(id) ON DELETE CASCADE,
  producto_id uuid REFERENCES public.productos(id),
  nombre_producto text NOT NULL,
  cantidad numeric NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric NOT NULL DEFAULT 0,
  motivo text NOT NULL,
  destino text NOT NULL CHECK (destino IN ('reingreso','merma'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devoluciones, public.devoluciones_detalle TO authenticated;
GRANT ALL ON public.devoluciones, public.devoluciones_detalle TO service_role;
ALTER TABLE public.devoluciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devoluciones_detalle ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_scope ON public.devoluciones AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id()) WITH CHECK (organization_id = public.current_organization_id());
CREATE POLICY staff_read ON public.devoluciones FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY staff_insert ON public.devoluciones FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY admin_del ON public.devoluciones FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY org_scope ON public.devoluciones_detalle AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id()) WITH CHECK (organization_id = public.current_organization_id());
CREATE POLICY staff_read ON public.devoluciones_detalle FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY staff_insert ON public.devoluciones_detalle FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER audit_devoluciones AFTER INSERT OR UPDATE OR DELETE ON public.devoluciones FOR EACH ROW EXECUTE FUNCTION public.log_auditoria();

-- Registro atómico e idempotente de devolución
CREATE OR REPLACE FUNCTION public.registrar_devolucion(p jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_id uuid := COALESCE((p->>'id')::uuid, gen_random_uuid());
  v_item jsonb; v_total numeric := 0; v_rest numeric; v_cred record; v_apl numeric; v_aplicado numeric := 0;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF EXISTS (SELECT 1 FROM devoluciones WHERE id = v_id) THEN RETURN v_id; END IF;
  INSERT INTO devoluciones (id, cliente_id, ruta_id, usuario_id, tipo, notas)
  VALUES (v_id, NULLIF(p->>'cliente_id','')::uuid, NULLIF(p->>'ruta_id','')::uuid, auth.uid(),
          COALESCE(p->>'tipo','cliente'), p->>'notas');
  FOR v_item IN SELECT * FROM jsonb_array_elements(p->'items') LOOP
    INSERT INTO devoluciones_detalle (devolucion_id, producto_id, nombre_producto, cantidad, precio_unitario, motivo, destino)
    VALUES (v_id, (v_item->>'producto_id')::uuid, v_item->>'nombre', (v_item->>'cantidad')::numeric,
            COALESCE((v_item->>'precio')::numeric,0), v_item->>'motivo', v_item->>'destino');
    v_total := v_total + (v_item->>'cantidad')::numeric * COALESCE((v_item->>'precio')::numeric,0);
    IF v_item->>'destino' = 'reingreso' THEN
      UPDATE productos SET existencia = existencia + (v_item->>'cantidad')::numeric WHERE id = (v_item->>'producto_id')::uuid;
      INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, motivo, usuario_id)
      VALUES ((v_item->>'producto_id')::uuid, 'entrada', (v_item->>'cantidad')::numeric, 'Devolución ' || v_id, auth.uid());
    ELSE
      INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, motivo, usuario_id)
      VALUES ((v_item->>'producto_id')::uuid, 'ajuste', 0, 'Merma ' || (v_item->>'motivo') || ' ' || (v_item->>'cantidad') || ' u. — Devolución ' || v_id, auth.uid());
    END IF;
  END LOOP;
  -- Rebajo a crédito (de lo más antiguo a lo más reciente)
  IF COALESCE((p->>'aplicar_credito')::boolean, false) AND (p->>'cliente_id') IS NOT NULL THEN
    v_rest := v_total;
    FOR v_cred IN SELECT id, saldo FROM creditos WHERE cliente_id = (p->>'cliente_id')::uuid AND saldo > 0 ORDER BY fecha ASC LOOP
      EXIT WHEN v_rest <= 0;
      v_apl := LEAST(v_rest, v_cred.saldo);
      UPDATE creditos SET saldo = saldo - v_apl, estado = CASE WHEN saldo - v_apl <= 0 THEN 'cancelado'::estado_credito ELSE estado END WHERE id = v_cred.id;
      v_rest := v_rest - v_apl; v_aplicado := v_aplicado + v_apl;
    END LOOP;
  END IF;
  UPDATE devoluciones SET total = v_total, aplicado_credito = v_aplicado WHERE id = v_id;
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.registrar_devolucion(jsonb) TO authenticated;

-- PEDIDOS (PREVENTA)
CREATE TABLE public.pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_organization_id() REFERENCES public.organizations(id),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  ruta_id uuid REFERENCES public.rutas(id),
  fecha_entrega date NOT NULL,
  estado text NOT NULL DEFAULT 'confirmado' CHECK (estado IN ('borrador','confirmado','cargado','entregado','anulado')),
  total numeric NOT NULL DEFAULT 0,
  notas text,
  venta_id uuid REFERENCES public.ventas(id),
  usuario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.pedidos_detalle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_organization_id() REFERENCES public.organizations(id),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES public.productos(id),
  nombre_producto text NOT NULL,
  cantidad numeric NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos, public.pedidos_detalle TO authenticated;
GRANT ALL ON public.pedidos, public.pedidos_detalle TO service_role;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_detalle ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_scope ON public.pedidos AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id()) WITH CHECK (organization_id = public.current_organization_id());
CREATE POLICY staff_all ON public.pedidos FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY org_scope ON public.pedidos_detalle AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id()) WITH CHECK (organization_id = public.current_organization_id());
CREATE POLICY staff_all ON public.pedidos_detalle FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_pedidos_updated BEFORE UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER audit_pedidos AFTER INSERT OR UPDATE OR DELETE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.log_auditoria();

-- DATOS FISCALES (Hacienda CR 4.4)
ALTER TABLE public.productos ADD COLUMN cabys text, ADD COLUMN tarifa_iva numeric NOT NULL DEFAULT 13;
ALTER TABLE public.clientes ADD COLUMN tipo_identificacion text, ADD COLUMN identificacion text, ADD COLUMN correo_fe text;
CREATE TABLE public.config_fiscal (
  organization_id uuid PRIMARY KEY DEFAULT public.current_organization_id() REFERENCES public.organizations(id),
  tipo_identificacion text NOT NULL DEFAULT '02',
  identificacion text NOT NULL DEFAULT '',
  nombre_fiscal text NOT NULL DEFAULT '',
  nombre_comercial text,
  actividad_economica text NOT NULL DEFAULT '',
  correo text, telefono text,
  provincia text, canton text, distrito text, otras_senas text,
  sucursal text NOT NULL DEFAULT '001',
  terminal text NOT NULL DEFAULT '00001',
  ambiente text NOT NULL DEFAULT 'staging' CHECK (ambiente IN ('staging','produccion')),
  activo boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.config_fiscal TO authenticated;
GRANT ALL ON public.config_fiscal TO service_role;
ALTER TABLE public.config_fiscal ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_scope ON public.config_fiscal AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id()) WITH CHECK (organization_id = public.current_organization_id());
CREATE POLICY staff_read ON public.config_fiscal FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY admin_ins ON public.config_fiscal FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY admin_upd ON public.config_fiscal FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER trg_config_fiscal_updated BEFORE UPDATE ON public.config_fiscal FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();