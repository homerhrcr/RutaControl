CREATE TABLE public.listas_precios (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL DEFAULT public.current_organization_id() REFERENCES public.organizations(id),
 nombre text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (organization_id, nombre), UNIQUE (organization_id, id)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.listas_precios TO authenticated;
GRANT ALL ON public.listas_precios TO service_role;
ALTER TABLE public.listas_precios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Empresa listas" ON public.listas_precios AS RESTRICTIVE FOR ALL TO authenticated USING (organization_id=public.current_organization_id()) WITH CHECK (organization_id=public.current_organization_id());
CREATE POLICY "Personal consulta listas" ON public.listas_precios FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Administrador gestiona listas" ON public.listas_precios FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER listas_precios_updated BEFORE UPDATE ON public.listas_precios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.productos ADD CONSTRAINT productos_org_id_unique UNIQUE (organization_id,id);
CREATE TABLE public.precios_productos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL DEFAULT public.current_organization_id() REFERENCES public.organizations(id),
 lista_id uuid NOT NULL,
 producto_id uuid NOT NULL,
 precio numeric(14,2) NOT NULL CHECK (precio >= 0),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(lista_id,producto_id),
 FOREIGN KEY(organization_id,lista_id) REFERENCES public.listas_precios(organization_id,id),
 FOREIGN KEY(organization_id,producto_id) REFERENCES public.productos(organization_id,id)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.precios_productos TO authenticated;
GRANT ALL ON public.precios_productos TO service_role;
ALTER TABLE public.precios_productos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Empresa precios" ON public.precios_productos AS RESTRICTIVE FOR ALL TO authenticated USING (organization_id=public.current_organization_id()) WITH CHECK (organization_id=public.current_organization_id());
CREATE POLICY "Personal consulta precios" ON public.precios_productos FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Administrador gestiona precios" ON public.precios_productos FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER precios_productos_updated BEFORE UPDATE ON public.precios_productos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE FUNCTION public.marcar_lista_precio_cambiada() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 UPDATE public.listas_precios SET updated_at=now() WHERE id=COALESCE(NEW.lista_id,OLD.lista_id);
 RETURN COALESCE(NEW,OLD);
END;
$$;
CREATE TRIGGER precio_lista_cambio AFTER INSERT OR UPDATE OR DELETE ON public.precios_productos FOR EACH ROW EXECUTE FUNCTION public.marcar_lista_precio_cambiada();
ALTER TABLE public.clientes ADD COLUMN lista_precio_id uuid;
ALTER TABLE public.clientes ADD CONSTRAINT clientes_lista_empresa_fk FOREIGN KEY(organization_id,lista_precio_id) REFERENCES public.listas_precios(organization_id,id);
CREATE OR REPLACE FUNCTION public.cambios_desde(p_desde timestamptz)
RETURNS TABLE(entidad text,cambios bigint,ultimo timestamptz) LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT 'ventas',count(*),max(created_at) FROM ventas WHERE created_at>p_desde
 UNION ALL SELECT 'abonos',count(*),max(created_at) FROM abonos WHERE created_at>p_desde
 UNION ALL SELECT 'creditos',count(*),max(updated_at) FROM creditos WHERE updated_at>p_desde
 UNION ALL SELECT 'clientes',count(*),max(updated_at) FROM clientes WHERE updated_at>p_desde
 UNION ALL SELECT 'cliente_rutas',count(*),max(created_at) FROM cliente_rutas WHERE created_at>p_desde
 UNION ALL SELECT 'productos',count(*),max(updated_at) FROM productos WHERE updated_at>p_desde
 UNION ALL SELECT 'gastos',count(*),max(updated_at) FROM gastos WHERE updated_at>p_desde
 UNION ALL SELECT 'rutas',count(*),max(created_at) FROM rutas WHERE created_at>p_desde
 UNION ALL SELECT 'evidencias',count(*),max(created_at) FROM evidencias WHERE created_at>p_desde
 UNION ALL SELECT 'cargas_camion',count(*),max(updated_at) FROM cargas_camion WHERE updated_at>p_desde
 UNION ALL SELECT 'pedidos',count(*),max(updated_at) FROM pedidos WHERE updated_at>p_desde
 UNION ALL SELECT 'listas_precios',count(*),max(updated_at) FROM listas_precios WHERE updated_at>p_desde
$$;