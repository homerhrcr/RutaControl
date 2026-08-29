CREATE TABLE public.categorias_gasto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias_gasto TO authenticated;
GRANT ALL ON public.categorias_gasto TO service_role;

ALTER TABLE public.categorias_gasto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados pueden ver categorias de gasto"
  ON public.categorias_gasto FOR SELECT TO authenticated USING (true);

CREATE POLICY "Autenticados pueden administrar categorias de gasto"
  ON public.categorias_gasto FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_categorias_gasto_updated_at
  BEFORE UPDATE ON public.categorias_gasto
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.categorias_gasto (nombre) VALUES
  ('Viáticos'), ('Combustible'), ('Insumos'), ('Otros');
