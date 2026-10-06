CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  codigo text NOT NULL UNIQUE,
  estado text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'vendedor',
  estado text NOT NULL DEFAULT 'active',
  es_predeterminada boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX organization_members_user_idx ON public.organization_members(user_id);
CREATE TABLE public.platform_admins (
  user_id uuid PRIMARY KEY,
  organizacion_activa uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
GRANT SELECT ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_admin(_uid uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = _uid);
$$;

CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT pa.organizacion_activa FROM public.platform_admins pa
       JOIN public.organizations o ON o.id = pa.organizacion_activa AND o.estado='active'
      WHERE pa.user_id = auth.uid()),
    (SELECT m.organization_id FROM public.organization_members m
       JOIN public.organizations o ON o.id = m.organization_id
      WHERE m.user_id = auth.uid() AND m.estado='active' AND o.estado='active'
      ORDER BY m.es_predeterminada DESC, m.created_at ASC LIMIT 1),
    (SELECT o.id FROM public.organizations o
      WHERE o.estado='active' AND EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
      ORDER BY o.created_at LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.set_default_organization(p_org uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF public.is_platform_admin(auth.uid()) THEN
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org AND estado='active') THEN
      RAISE EXCEPTION 'Empresa no existe';
    END IF;
    UPDATE public.platform_admins SET organizacion_activa = p_org WHERE user_id = auth.uid();
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organization_members m JOIN public.organizations o ON o.id=m.organization_id
     WHERE m.user_id = auth.uid() AND m.organization_id = p_org AND m.estado='active' AND o.estado='active') THEN
    RAISE EXCEPTION 'No pertenece a esa empresa';
  END IF;
  UPDATE public.organization_members SET es_predeterminada = (organization_id = p_org), updated_at = now()
   WHERE user_id = auth.uid();
END; $$;
REVOKE ALL ON FUNCTION public.set_default_organization(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_default_organization(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (public.is_platform_admin(_user_id) AND _role = 'administrador')
    OR EXISTS (SELECT 1 FROM public.organization_members
      WHERE user_id = _user_id AND role = _role AND estado='active'
        AND organization_id = public.current_organization_id());
$$;
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'administrador');
$$;
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_platform_admin(_user_id) OR EXISTS (SELECT 1 FROM public.organization_members
      WHERE user_id = _user_id AND estado='active'
        AND organization_id = public.current_organization_id());
$$;

CREATE POLICY "Ver empresas propias" ON public.organizations FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()) OR id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));
CREATE POLICY "Ver membresias" ON public.organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid()) OR (organization_id = public.current_organization_id() AND public.is_admin(auth.uid())));
CREATE POLICY "Ver propio superadmin" ON public.platform_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid());

INSERT INTO public.organizations (nombre, codigo) VALUES ('Lácteos La Rivera', 'LACTEOS-LA-RIVERA');

DO $$
DECLARE t text; v_org uuid;
BEGIN
  SELECT id INTO v_org FROM public.organizations WHERE codigo='LACTEOS-LA-RIVERA';
  FOREACH t IN ARRAY ARRAY['abonos','auditoria','categorias','categorias_gasto','cliente_rutas','clientes','creditos','detalle_ventas','gastos','movimientos_inventario','productos','rutas','ventas'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE', t);
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', t);
    EXECUTE format('UPDATE public.%I SET organization_id = %L', t, v_org);
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id SET DEFAULT public.current_organization_id()', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id SET NOT NULL', t);
    EXECUTE format('CREATE INDEX %I ON public.%I(organization_id)', t || '_org_idx', t);
    EXECUTE format('CREATE POLICY "Aislamiento por empresa" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (organization_id = public.current_organization_id()) WITH CHECK (organization_id = public.current_organization_id())', t);
  END LOOP;
END $$;

ALTER TABLE public.categorias DROP CONSTRAINT categorias_nombre_key;
ALTER TABLE public.categorias ADD CONSTRAINT categorias_org_nombre_key UNIQUE (organization_id, nombre);
ALTER TABLE public.categorias_gasto DROP CONSTRAINT categorias_gasto_nombre_key;
ALTER TABLE public.categorias_gasto ADD CONSTRAINT categorias_gasto_org_nombre_key UNIQUE (organization_id, nombre);
ALTER TABLE public.productos DROP CONSTRAINT productos_codigo_key;
ALTER TABLE public.productos ADD CONSTRAINT productos_org_codigo_key UNIQUE (organization_id, codigo);
ALTER TABLE public.rutas DROP CONSTRAINT rutas_nombre_key;
ALTER TABLE public.rutas ADD CONSTRAINT rutas_org_nombre_key UNIQUE (organization_id, nombre);

CREATE OR REPLACE FUNCTION public.log_auditoria()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_org uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN v_org := OLD.organization_id; ELSE v_org := NEW.organization_id; END IF;
  INSERT INTO public.auditoria (usuario_id, accion, entidad, detalle, organization_id)
  VALUES (auth.uid(), TG_OP, TG_TABLE_NAME,
    jsonb_build_object('op', TG_OP,
      'nuevo', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
      'anterior', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END),
    COALESCE(v_org, public.current_organization_id()));
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
BEGIN
  INSERT INTO public.profiles (id, nombre)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $function$;

COMMENT ON TABLE public.user_roles IS 'DEPRECATED: roles now live in organization_members per company';