CREATE TABLE public.evidencias (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL DEFAULT public.current_organization_id(),
  entidad text NOT NULL,
  entidad_id uuid NOT NULL,
  storage_path text NOT NULL,
  nombre_archivo text NOT NULL,
  mime_type text NOT NULL,
  tamano bigint NOT NULL,
  sha256 text NOT NULL,
  capturada_en timestamptz NOT NULL,
  latitud double precision,
  longitud double precision,
  usuario_id uuid NOT NULL,
  device_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.evidencias TO authenticated;
GRANT ALL ON public.evidencias TO service_role;
ALTER TABLE public.evidencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Aislamiento por empresa" ON public.evidencias AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id()) WITH CHECK (organization_id = public.current_organization_id());
CREATE POLICY "Staff ve evidencias" ON public.evidencias FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff crea evidencias" ON public.evidencias FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()) AND usuario_id = auth.uid());
CREATE POLICY "Admin borra evidencias" ON public.evidencias FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE INDEX evidencias_entidad_idx ON public.evidencias(entidad, entidad_id);

CREATE TABLE public.sync_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_organization_id(),
  operation_id uuid NOT NULL UNIQUE,
  entity text NOT NULL,
  entity_id uuid NOT NULL,
  device_id text NOT NULL,
  user_id uuid NOT NULL,
  local_data jsonb NOT NULL,
  server_data jsonb,
  conflict_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  resolution text,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED','DISMISSED'))
);
GRANT SELECT, INSERT, UPDATE ON public.sync_conflicts TO authenticated;
GRANT ALL ON public.sync_conflicts TO service_role;
ALTER TABLE public.sync_conflicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Aislamiento por empresa" ON public.sync_conflicts AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id()) WITH CHECK (organization_id = public.current_organization_id());
CREATE POLICY "Ver conflictos propios o admin" ON public.sync_conflicts FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Registrar conflicto propio" ON public.sync_conflicts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_staff(auth.uid()) AND status = 'OPEN');
CREATE POLICY "Admin resuelve conflictos" ON public.sync_conflicts FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Cursor incremental: qué tablas cambiaron desde la última sincronización del dispositivo
CREATE OR REPLACE FUNCTION public.cambios_desde(p_desde timestamptz)
RETURNS TABLE(entidad text, cambios bigint, ultimo timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT 'ventas', count(*), max(created_at) FROM ventas WHERE created_at > p_desde
  UNION ALL SELECT 'abonos', count(*), max(created_at) FROM abonos WHERE created_at > p_desde
  UNION ALL SELECT 'creditos', count(*), max(updated_at) FROM creditos WHERE updated_at > p_desde
  UNION ALL SELECT 'clientes', count(*), max(updated_at) FROM clientes WHERE updated_at > p_desde
  UNION ALL SELECT 'cliente_rutas', count(*), max(created_at) FROM cliente_rutas WHERE created_at > p_desde
  UNION ALL SELECT 'productos', count(*), max(updated_at) FROM productos WHERE updated_at > p_desde
  UNION ALL SELECT 'gastos', count(*), max(updated_at) FROM gastos WHERE updated_at > p_desde
  UNION ALL SELECT 'rutas', count(*), max(created_at) FROM rutas WHERE created_at > p_desde
  UNION ALL SELECT 'evidencias', count(*), max(created_at) FROM evidencias WHERE created_at > p_desde
$$;
REVOKE EXECUTE ON FUNCTION public.cambios_desde(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cambios_desde(timestamptz) TO authenticated;