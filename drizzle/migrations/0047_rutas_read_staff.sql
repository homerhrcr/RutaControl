DROP POLICY IF EXISTS "Rutas read" ON public.rutas;
CREATE POLICY "Rutas read" ON public.rutas FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR public.is_platform_admin(auth.uid()));