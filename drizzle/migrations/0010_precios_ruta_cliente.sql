ALTER TABLE public.listas_precios
  ADD COLUMN IF NOT EXISTS descripcion text,
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS fecha_inicio date,
  ADD COLUMN IF NOT EXISTS fecha_fin date;

ALTER TABLE public.rutas
  ADD COLUMN IF NOT EXISTS lista_precio_id uuid REFERENCES public.listas_precios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS rutas_lista_precio_idx ON public.rutas(lista_precio_id);
DROP TRIGGER IF EXISTS rutas_updated ON public.rutas;
CREATE TRIGGER rutas_updated BEFORE UPDATE ON public.rutas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.precios_especiales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_organization_id() REFERENCES public.organizations(id),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  ruta_id uuid REFERENCES public.rutas(id) ON DELETE CASCADE,
  precio numeric(12,2) NOT NULL CHECK (precio >= 0),
  fecha_inicio date NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin date,
  activo boolean NOT NULL DEFAULT true,
  creado_por uuid DEFAULT auth.uid(),
  modificado_por uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);
CREATE INDEX precios_especiales_cliente_idx ON public.precios_especiales(cliente_id, producto_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.precios_especiales TO authenticated;
GRANT ALL ON public.precios_especiales TO service_role;
ALTER TABLE public.precios_especiales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Empresa precios especiales" ON public.precios_especiales AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id()) WITH CHECK (organization_id = public.current_organization_id());
CREATE POLICY "Personal consulta precios especiales" ON public.precios_especiales FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Administrador gestiona precios especiales" ON public.precios_especiales FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.validar_precio_especial()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.updated_at := now();
  NEW.modificado_por := COALESCE(auth.uid(), NEW.modificado_por);
  IF NOT EXISTS (SELECT 1 FROM clientes WHERE id=NEW.cliente_id AND organization_id=NEW.organization_id)
     OR NOT EXISTS (SELECT 1 FROM productos WHERE id=NEW.producto_id AND organization_id=NEW.organization_id)
     OR (NEW.ruta_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM rutas WHERE id=NEW.ruta_id AND organization_id=NEW.organization_id)) THEN
    RAISE EXCEPTION 'Cliente, producto o ruta no pertenecen a la empresa';
  END IF;
  IF NEW.activo AND EXISTS (
    SELECT 1 FROM precios_especiales e WHERE e.id<>NEW.id AND e.activo
      AND e.cliente_id=NEW.cliente_id AND e.producto_id=NEW.producto_id
      AND e.ruta_id IS NOT DISTINCT FROM NEW.ruta_id
      AND daterange(e.fecha_inicio, COALESCE(e.fecha_fin,'infinity'::date), '[]')
          && daterange(NEW.fecha_inicio, COALESCE(NEW.fecha_fin,'infinity'::date), '[]')) THEN
    RAISE EXCEPTION 'Ya existe un precio especial activo para este cliente, producto y alcance en ese período';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER precios_especiales_validar BEFORE INSERT OR UPDATE ON public.precios_especiales FOR EACH ROW EXECUTE FUNCTION public.validar_precio_especial();
CREATE TRIGGER audit_precios_especiales AFTER INSERT OR UPDATE OR DELETE ON public.precios_especiales FOR EACH ROW EXECUTE FUNCTION public.log_auditoria();

CREATE OR REPLACE FUNCTION public.cambios_desde(p_desde timestamp with time zone)
 RETURNS TABLE(entidad text, cambios bigint, ultimo timestamp with time zone)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
 SELECT 'ventas',count(*),max(created_at) FROM ventas WHERE created_at>p_desde
 UNION ALL SELECT 'abonos',count(*),max(created_at) FROM abonos WHERE created_at>p_desde
 UNION ALL SELECT 'creditos',count(*),max(updated_at) FROM creditos WHERE updated_at>p_desde
 UNION ALL SELECT 'clientes',count(*),max(updated_at) FROM clientes WHERE updated_at>p_desde
 UNION ALL SELECT 'cliente_rutas',count(*),max(created_at) FROM cliente_rutas WHERE created_at>p_desde
 UNION ALL SELECT 'productos',count(*),max(updated_at) FROM productos WHERE updated_at>p_desde
 UNION ALL SELECT 'gastos',count(*),max(updated_at) FROM gastos WHERE updated_at>p_desde
 UNION ALL SELECT 'rutas',count(*),max(updated_at) FROM rutas WHERE updated_at>p_desde
 UNION ALL SELECT 'evidencias',count(*),max(created_at) FROM evidencias WHERE created_at>p_desde
 UNION ALL SELECT 'cargas_camion',count(*),max(updated_at) FROM cargas_camion WHERE updated_at>p_desde
 UNION ALL SELECT 'pedidos',count(*),max(updated_at) FROM pedidos WHERE updated_at>p_desde
 UNION ALL SELECT 'listas_precios',count(*),max(updated_at) FROM listas_precios WHERE updated_at>p_desde
 UNION ALL SELECT 'precios_especiales',count(*),max(updated_at) FROM precios_especiales WHERE updated_at>p_desde
$function$;