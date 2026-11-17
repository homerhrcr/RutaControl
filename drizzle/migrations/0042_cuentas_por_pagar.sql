CREATE TABLE public.cuentas_por_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_organization_id() REFERENCES public.organizations(id),
  fecha date NOT NULL DEFAULT current_date,
  proveedor text NOT NULL,
  producto text NOT NULL,
  cantidad numeric NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  unidad text NOT NULL DEFAULT 'unidad',
  monto numeric NOT NULL CHECK (monto > 0),
  pagado numeric NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'pendiente',
  notas text,
  usuario_id uuid DEFAULT auth.uid(),
  cancelada_en timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.pagos_cuentas_por_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_organization_id() REFERENCES public.organizations(id),
  cuenta_id uuid NOT NULL REFERENCES public.cuentas_por_pagar(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT current_date,
  monto numeric NOT NULL CHECK (monto > 0),
  medio_pago text,
  referencia text,
  usuario_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.cuentas_por_pagar(organization_id, estado);
CREATE INDEX ON public.pagos_cuentas_por_pagar(cuenta_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cuentas_por_pagar TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.pagos_cuentas_por_pagar TO authenticated;
GRANT ALL ON public.cuentas_por_pagar TO service_role;
GRANT ALL ON public.pagos_cuentas_por_pagar TO service_role;

ALTER TABLE public.cuentas_por_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_cuentas_por_pagar ENABLE ROW LEVEL SECURITY;

CREATE POLICY cxp_empresa ON public.cuentas_por_pagar AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id()) WITH CHECK (organization_id = public.current_organization_id());
CREATE POLICY cxp_sel ON public.cuentas_por_pagar FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY cxp_ins ON public.cuentas_por_pagar FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY cxp_upd ON public.cuentas_por_pagar FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY cxp_del ON public.cuentas_por_pagar FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY pcxp_empresa ON public.pagos_cuentas_por_pagar AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id()) WITH CHECK (organization_id = public.current_organization_id());
CREATE POLICY pcxp_sel ON public.pagos_cuentas_por_pagar FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY pcxp_ins ON public.pagos_cuentas_por_pagar FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY pcxp_del ON public.pagos_cuentas_por_pagar FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.trg_pago_cxp_validar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  SELECT * INTO c FROM cuentas_por_pagar WHERE id = NEW.cuenta_id FOR UPDATE;
  IF c.id IS NULL OR c.organization_id <> NEW.organization_id THEN RAISE EXCEPTION 'Cuenta no encontrada'; END IF;
  IF NEW.monto > round(c.monto - c.pagado, 2) + 0.001 THEN RAISE EXCEPTION 'El pago supera el saldo pendiente'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.trg_pago_cxp_recalcular() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid := COALESCE(NEW.cuenta_id, OLD.cuenta_id); tot numeric;
BEGIN
  SELECT COALESCE(sum(monto),0) INTO tot FROM pagos_cuentas_por_pagar WHERE cuenta_id = cid;
  UPDATE cuentas_por_pagar SET pagado = tot,
    estado = CASE WHEN tot >= monto - 0.001 THEN 'cancelado' WHEN tot > 0 THEN 'parcial' ELSE 'pendiente' END,
    cancelada_en = CASE WHEN tot >= monto - 0.001 THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = cid;
  RETURN NULL;
END $$;

CREATE TRIGGER pago_cxp_validar BEFORE INSERT ON public.pagos_cuentas_por_pagar FOR EACH ROW EXECUTE FUNCTION public.trg_pago_cxp_validar();
CREATE TRIGGER pago_cxp_recalcular AFTER INSERT OR DELETE ON public.pagos_cuentas_por_pagar FOR EACH ROW EXECUTE FUNCTION public.trg_pago_cxp_recalcular();