-- Tabla de relación muchos-a-muchos entre clientes y rutas
CREATE TABLE public.cliente_rutas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  ruta_id uuid NOT NULL REFERENCES public.rutas(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, ruta_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_rutas TO authenticated;
GRANT ALL ON public.cliente_rutas TO service_role;

ALTER TABLE public.cliente_rutas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden ver asignaciones de rutas"
  ON public.cliente_rutas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados pueden crear asignaciones de rutas"
  ON public.cliente_rutas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuarios autenticados pueden actualizar asignaciones de rutas"
  ON public.cliente_rutas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados pueden eliminar asignaciones de rutas"
  ON public.cliente_rutas FOR DELETE TO authenticated USING (true);

-- Migrar asignaciones existentes (ruta_id en clientes) a la nueva tabla
INSERT INTO public.cliente_rutas (cliente_id, ruta_id)
SELECT id, ruta_id FROM public.clientes WHERE ruta_id IS NOT NULL
ON CONFLICT (cliente_id, ruta_id) DO NOTHING;