CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('administrador'::app_role, 'vendedor'::app_role, 'cobrador'::app_role)
  )
$$;

DROP POLICY IF EXISTS "Ventas read" ON public.ventas;
CREATE POLICY "Ventas read staff" ON public.ventas FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Detalle read" ON public.detalle_ventas;
CREATE POLICY "Detalle read staff" ON public.detalle_ventas FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Creditos read" ON public.creditos;
CREATE POLICY "Creditos read staff" ON public.creditos FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Abonos read" ON public.abonos;
CREATE POLICY "Abonos read staff" ON public.abonos FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Movimientos read" ON public.movimientos_inventario;
CREATE POLICY "Movimientos read staff" ON public.movimientos_inventario FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));