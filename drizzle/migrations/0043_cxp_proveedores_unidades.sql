CREATE TABLE public.proveedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_organization_id() REFERENCES public.organizations(id),
  nombre text NOT NULL CHECK (length(btrim(nombre)) BETWEEN 1 AND 120),
  identificacion text,
  telefono text,
  correo text,
  activo boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX proveedores_nombre_uq ON public.proveedores (organization_id, lower(btrim(nombre)));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proveedores TO authenticated;
GRANT ALL ON public.proveedores TO service_role;
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY prov_empresa ON public.proveedores AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id()) WITH CHECK (organization_id = public.current_organization_id());
CREATE POLICY prov_sel ON public.proveedores FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY prov_ins ON public.proveedores FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY prov_upd ON public.proveedores FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY prov_del ON public.proveedores FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

INSERT INTO public.proveedores (organization_id, nombre)
SELECT DISTINCT ON (organization_id, lower(btrim(proveedor))) organization_id, btrim(proveedor)
FROM public.cuentas_por_pagar WHERE btrim(proveedor) <> ''
ON CONFLICT DO NOTHING;

ALTER TABLE public.cuentas_por_pagar ADD COLUMN numero_factura text;

ALTER TABLE public.catalogo_opciones DROP CONSTRAINT catalogo_opciones_catalogo_chk;
ALTER TABLE public.catalogo_opciones ADD CONSTRAINT catalogo_opciones_catalogo_chk CHECK (catalogo = ANY (ARRAY['motivo_devolucion','destino_devolucion','tipo_identificacion','tarifa_iva','metodo_pago','motivo_cancelacion_pedido','categoria_gasto_planta','medio_pago','unidad_medida']));

INSERT INTO public.catalogo_opciones (organization_id, catalogo, codigo, etiqueta, orden, predeterminado)
SELECT o.id, 'unidad_medida', u.c, u.c, u.n, u.n = 1
FROM public.organizations o
CROSS JOIN (VALUES ('unidad',1),('kg',2),('g',3),('litro',4),('caja',5),('paquete',6),('saco',7),('quintal',8),('galón',9)) AS u(c,n)
ON CONFLICT DO NOTHING;