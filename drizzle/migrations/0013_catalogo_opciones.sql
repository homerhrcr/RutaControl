CREATE TABLE public.catalogo_opciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_organization_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  catalogo text NOT NULL,
  codigo text NOT NULL,
  etiqueta text NOT NULL,
  descripcion text,
  activo boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 0,
  predeterminado boolean NOT NULL DEFAULT false,
  protegido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalogo_opciones_codigo_key UNIQUE (organization_id, catalogo, codigo),
  CONSTRAINT catalogo_opciones_etiqueta_chk CHECK (length(btrim(etiqueta)) BETWEEN 1 AND 80),
  CONSTRAINT catalogo_opciones_catalogo_chk CHECK (catalogo IN ('motivo_devolucion','destino_devolucion','tipo_identificacion','tarifa_iva','metodo_pago'))
);
CREATE UNIQUE INDEX catalogo_opciones_etiqueta_uq ON public.catalogo_opciones (organization_id, catalogo, lower(btrim(etiqueta)));
CREATE UNIQUE INDEX catalogo_opciones_predet_uq ON public.catalogo_opciones (organization_id, catalogo) WHERE predeterminado;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogo_opciones TO authenticated;
GRANT ALL ON public.catalogo_opciones TO service_role;
ALTER TABLE public.catalogo_opciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Empresa opciones" ON public.catalogo_opciones AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id()) WITH CHECK (organization_id = public.current_organization_id());
CREATE POLICY "Leer opciones" ON public.catalogo_opciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin crea opciones" ON public.catalogo_opciones FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) AND NOT protegido);
CREATE POLICY "Admin edita opciones" ON public.catalogo_opciones FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admin elimina opciones" ON public.catalogo_opciones FOR DELETE TO authenticated USING (public.is_admin(auth.uid()) AND NOT protegido);

CREATE OR REPLACE FUNCTION public.proteger_catalogo_opcion() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.protegido AND (NEW.codigo <> OLD.codigo OR NEW.catalogo <> OLD.catalogo OR NOT NEW.protegido) THEN
    RAISE EXCEPTION 'El código de una opción protegida no se puede modificar';
  END IF;
  IF NEW.codigo <> OLD.codigo THEN RAISE EXCEPTION 'El código de una opción no se puede modificar'; END IF;
  IF OLD.protegido AND OLD.catalogo IN ('destino_devolucion','metodo_pago') AND NOT NEW.activo THEN
    RAISE EXCEPTION 'Esta opción es requerida por el sistema y no se puede desactivar';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_proteger_catalogo_opcion BEFORE UPDATE ON public.catalogo_opciones FOR EACH ROW EXECUTE FUNCTION public.proteger_catalogo_opcion();
CREATE TRIGGER trg_auditoria_catalogo_opciones AFTER INSERT OR UPDATE OR DELETE ON public.catalogo_opciones FOR EACH ROW EXECUTE FUNCTION public.log_auditoria();

CREATE OR REPLACE FUNCTION public.sembrar_catalogo_opciones(p_org uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.catalogo_opciones (organization_id, catalogo, codigo, etiqueta, orden, predeterminado, protegido) VALUES
  (p_org,'motivo_devolucion','Vencido','Vencido',1,true,false),
  (p_org,'motivo_devolucion','Dañado / quebrado','Dañado / quebrado',2,false,false),
  (p_org,'motivo_devolucion','Mal estado','Mal estado',3,false,false),
  (p_org,'motivo_devolucion','Empaque dañado','Empaque dañado',4,false,false),
  (p_org,'motivo_devolucion','No vendido','No vendido',5,false,false),
  (p_org,'motivo_devolucion','Producto no solicitado','Producto no solicitado',6,false,false),
  (p_org,'motivo_devolucion','Error de pedido','Error de pedido',7,false,false),
  (p_org,'motivo_devolucion','Otro','Otro',8,false,false),
  (p_org,'destino_devolucion','merma','Merma (se desecha)',1,true,true),
  (p_org,'destino_devolucion','reingreso','Regresa a bodega',2,false,true),
  (p_org,'tipo_identificacion','01','Física',1,false,true),
  (p_org,'tipo_identificacion','02','Jurídica',2,true,true),
  (p_org,'tipo_identificacion','03','DIMEX',3,false,true),
  (p_org,'tipo_identificacion','04','NITE',4,false,true),
  (p_org,'tarifa_iva','13','13%',1,true,true),
  (p_org,'tarifa_iva','4','4%',2,false,true),
  (p_org,'tarifa_iva','2','2%',3,false,true),
  (p_org,'tarifa_iva','1','1%',4,false,true),
  (p_org,'tarifa_iva','0','Exento (0%)',5,false,true),
  (p_org,'metodo_pago','contado','Contado',1,true,true),
  (p_org,'metodo_pago','credito','Crédito',2,false,true)
  ON CONFLICT (organization_id, catalogo, codigo) DO NOTHING;
$$;
REVOKE EXECUTE ON FUNCTION public.sembrar_catalogo_opciones(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_sembrar_catalogo_org() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.sembrar_catalogo_opciones(NEW.id); RETURN NEW; END $$;
CREATE TRIGGER trg_sembrar_catalogo_org AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.trg_sembrar_catalogo_org();

SELECT public.sembrar_catalogo_opciones(id) FROM public.organizations;

ALTER TABLE public.categorias ADD COLUMN IF NOT EXISTS descripcion text, ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS orden integer NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS predeterminado boolean NOT NULL DEFAULT false;
ALTER TABLE public.categorias_gasto ADD COLUMN IF NOT EXISTS descripcion text, ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS orden integer NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS predeterminado boolean NOT NULL DEFAULT false;
ALTER TABLE public.rutas ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS orden integer NOT NULL DEFAULT 0;