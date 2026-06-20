
-- Helper: is the user a known staff member (has any role)?
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

-- profiles: only own profile or admin can read
DROP POLICY IF EXISTS "Profiles readable by authenticated" ON public.profiles;
CREATE POLICY "Profiles readable by self or admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_admin(auth.uid()));

-- clientes: restrict customer PII reads to staff
DROP POLICY IF EXISTS "Clientes read" ON public.clientes;
CREATE POLICY "Clientes read" ON public.clientes
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Clientes insert staff" ON public.clientes;
CREATE POLICY "Clientes insert staff" ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Clientes update staff" ON public.clientes;
CREATE POLICY "Clientes update staff" ON public.clientes
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- productos writes
DROP POLICY IF EXISTS "Productos insert staff" ON public.productos;
CREATE POLICY "Productos insert staff" ON public.productos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Productos update staff" ON public.productos;
CREATE POLICY "Productos update staff" ON public.productos
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- ventas writes
DROP POLICY IF EXISTS "Ventas insert staff" ON public.ventas;
CREATE POLICY "Ventas insert staff" ON public.ventas
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Ventas update staff" ON public.ventas;
CREATE POLICY "Ventas update staff" ON public.ventas
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- detalle_ventas writes
DROP POLICY IF EXISTS "Detalle write staff" ON public.detalle_ventas;
CREATE POLICY "Detalle write staff" ON public.detalle_ventas
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- creditos writes
DROP POLICY IF EXISTS "Creditos write staff" ON public.creditos;
CREATE POLICY "Creditos write staff" ON public.creditos
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- movimientos_inventario writes
DROP POLICY IF EXISTS "Movimientos write staff" ON public.movimientos_inventario;
CREATE POLICY "Movimientos write staff" ON public.movimientos_inventario
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- abonos writes
DROP POLICY IF EXISTS "Abonos write staff" ON public.abonos;
CREATE POLICY "Abonos write staff" ON public.abonos
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- auditoria insert
DROP POLICY IF EXISTS "Auditoria insert staff" ON public.auditoria;
CREATE POLICY "Auditoria insert staff" ON public.auditoria
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

-- cliente_rutas writes
DROP POLICY IF EXISTS "Usuarios autenticados pueden crear asignaciones de rutas" ON public.cliente_rutas;
CREATE POLICY "Usuarios autenticados pueden crear asignaciones de rutas" ON public.cliente_rutas
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar asignaciones de rutas" ON public.cliente_rutas;
CREATE POLICY "Usuarios autenticados pueden actualizar asignaciones de rutas" ON public.cliente_rutas
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar asignaciones de rutas" ON public.cliente_rutas;
CREATE POLICY "Usuarios autenticados pueden eliminar asignaciones de rutas" ON public.cliente_rutas
  FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()));

-- Restrict role-check helpers from anonymous callers
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
