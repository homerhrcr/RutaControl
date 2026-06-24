CREATE TABLE public.gastos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha timestamptz NOT NULL DEFAULT now(),
  ruta_id uuid REFERENCES public.rutas(id) ON DELETE SET NULL,
  usuario_id uuid,
  categoria text NOT NULL DEFAULT 'otros',
  descripcion text,
  monto numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gastos TO authenticated;
GRANT ALL ON public.gastos TO service_role;

ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view gastos" ON public.gastos
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can insert gastos" ON public.gastos
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can update gastos" ON public.gastos
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can delete gastos" ON public.gastos
  FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

CREATE TRIGGER update_gastos_updated_at
  BEFORE UPDATE ON public.gastos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER audit_gastos
  AFTER INSERT OR UPDATE OR DELETE ON public.gastos
  FOR EACH ROW EXECUTE FUNCTION public.log_auditoria();