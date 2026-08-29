DROP POLICY "Autenticados pueden administrar categorias de gasto" ON public.categorias_gasto;

CREATE POLICY "Categorias gasto admin write"
  ON public.categorias_gasto FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
