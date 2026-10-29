CREATE TABLE public.finca_gastos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_organization_id() REFERENCES public.organizations(id),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  categoria text NOT NULL,
  descripcion text,
  monto numeric NOT NULL CHECK (monto > 0),
  usuario_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.finca_productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_organization_id() REFERENCES public.organizations(id),
  nombre text NOT NULL,
  unidad text NOT NULL DEFAULT 'unidad',
  precio numeric NOT NULL DEFAULT 0 CHECK (precio >= 0),
  activo boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.finca_produccion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_organization_id() REFERENCES public.organizations(id),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  producto_id uuid NOT NULL REFERENCES public.finca_productos(id),
  cantidad numeric NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric NOT NULL CHECK (precio_unitario >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finca_gastos, public.finca_productos, public.finca_produccion TO authenticated;
GRANT ALL ON public.finca_gastos, public.finca_productos, public.finca_produccion TO service_role;
ALTER TABLE public.finca_gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finca_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finca_produccion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins empresa finca_gastos" ON public.finca_gastos FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id() AND public.is_admin(auth.uid()))
  WITH CHECK (organization_id = public.current_organization_id() AND public.is_admin(auth.uid()));
CREATE POLICY "Admins empresa finca_productos" ON public.finca_productos FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id() AND public.is_admin(auth.uid()))
  WITH CHECK (organization_id = public.current_organization_id() AND public.is_admin(auth.uid()));
CREATE POLICY "Admins empresa finca_produccion" ON public.finca_produccion FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id() AND public.is_admin(auth.uid()))
  WITH CHECK (organization_id = public.current_organization_id() AND public.is_admin(auth.uid()));
INSERT INTO public.finca_productos (organization_id, nombre, unidad, orden)
SELECT o.id, p.nombre, p.unidad, p.orden FROM public.organizations o
CROSS JOIN (VALUES ('Leche de vaca','litro',1),('Leche de cabra','litro',2),('Queso','kg',3),('Yogur','unidad',4),('Natilla','unidad',5),('Cuajada','unidad',6),('Queso rallado','kg',7),('Leche agria','unidad',8)) AS p(nombre,unidad,orden)
WHERE o.nombre ILIKE '%rivera%';