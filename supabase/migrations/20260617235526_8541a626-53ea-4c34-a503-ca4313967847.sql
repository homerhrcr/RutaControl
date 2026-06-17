
-- ROLES
CREATE TYPE public.app_role AS ENUM ('administrador', 'vendedor', 'cobrador');
CREATE TYPE public.metodo_pago AS ENUM ('contado', 'credito');
CREATE TYPE public.estado_credito AS ENUM ('al_dia', 'vencido', 'cancelado');
CREATE TYPE public.tipo_movimiento AS ENUM ('entrada', 'salida', 'ajuste');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL DEFAULT '',
  telefono TEXT,
  ruta_default UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'administrador')
$$;

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- new user handler
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email));
  -- first user becomes administrador, others vendedor
  IF (SELECT count(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'administrador');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'vendedor');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CATEGORIAS
CREATE TABLE public.categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias TO authenticated;
GRANT ALL ON public.categorias TO service_role;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categorias read" ON public.categorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Categorias admin write" ON public.categorias FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- PRODUCTOS
CREATE TABLE public.productos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  precio NUMERIC(12,2) NOT NULL DEFAULT 0,
  costo NUMERIC(12,2) NOT NULL DEFAULT 0,
  existencia NUMERIC(12,2) NOT NULL DEFAULT 0,
  existencia_minima NUMERIC(12,2) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.productos TO authenticated;
GRANT ALL ON public.productos TO service_role;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Productos read" ON public.productos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Productos insert staff" ON public.productos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Productos update staff" ON public.productos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Productos delete admin" ON public.productos FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE TRIGGER trg_productos_updated BEFORE UPDATE ON public.productos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RUTAS
CREATE TABLE public.rutas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  dia TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rutas TO authenticated;
GRANT ALL ON public.rutas TO service_role;
ALTER TABLE public.rutas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rutas read" ON public.rutas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Rutas admin write" ON public.rutas FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- CLIENTES
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  telefono TEXT,
  direccion TEXT,
  distrito TEXT,
  canton TEXT,
  provincia TEXT,
  referencia TEXT,
  foto_url TEXT,
  latitud NUMERIC(10,7),
  longitud NUMERIC(10,7),
  ruta_id UUID REFERENCES public.rutas(id) ON DELETE SET NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clientes read" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Clientes insert staff" ON public.clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Clientes update staff" ON public.clientes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Clientes delete admin" ON public.clientes FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE TRIGGER trg_clientes_updated BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- VENTAS
CREATE TABLE public.ventas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  ruta_id UUID REFERENCES public.rutas(id) ON DELETE SET NULL,
  vendedor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  descuento NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  metodo_pago metodo_pago NOT NULL DEFAULT 'contado',
  latitud NUMERIC(10,7),
  longitud NUMERIC(10,7),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ventas TO authenticated;
GRANT ALL ON public.ventas TO service_role;
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ventas read" ON public.ventas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Ventas insert staff" ON public.ventas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Ventas update staff" ON public.ventas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Ventas delete admin" ON public.ventas FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- DETALLE VENTAS
CREATE TABLE public.detalle_ventas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES public.productos(id) ON DELETE SET NULL,
  nombre_producto TEXT NOT NULL,
  cantidad NUMERIC(12,2) NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_linea NUMERIC(12,2) NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.detalle_ventas TO authenticated;
GRANT ALL ON public.detalle_ventas TO service_role;
ALTER TABLE public.detalle_ventas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Detalle read" ON public.detalle_ventas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Detalle write staff" ON public.detalle_ventas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- CREDITOS
CREATE TABLE public.creditos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID REFERENCES public.ventas(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  monto NUMERIC(12,2) NOT NULL DEFAULT 0,
  saldo NUMERIC(12,2) NOT NULL DEFAULT 0,
  fecha_limite DATE,
  estado estado_credito NOT NULL DEFAULT 'al_dia',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creditos TO authenticated;
GRANT ALL ON public.creditos TO service_role;
ALTER TABLE public.creditos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creditos read" ON public.creditos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Creditos write staff" ON public.creditos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_creditos_updated BEFORE UPDATE ON public.creditos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ABONOS
CREATE TABLE public.abonos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credito_id UUID NOT NULL REFERENCES public.creditos(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  monto NUMERIC(12,2) NOT NULL DEFAULT 0,
  cobrador_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.abonos TO authenticated;
GRANT ALL ON public.abonos TO service_role;
ALTER TABLE public.abonos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Abonos read" ON public.abonos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Abonos write staff" ON public.abonos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- MOVIMIENTOS INVENTARIO
CREATE TABLE public.movimientos_inventario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  tipo tipo_movimiento NOT NULL,
  cantidad NUMERIC(12,2) NOT NULL DEFAULT 0,
  motivo TEXT,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimientos_inventario TO authenticated;
GRANT ALL ON public.movimientos_inventario TO service_role;
ALTER TABLE public.movimientos_inventario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Movimientos read" ON public.movimientos_inventario FOR SELECT TO authenticated USING (true);
CREATE POLICY "Movimientos write staff" ON public.movimientos_inventario FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- AUDITORIA
CREATE TABLE public.auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accion TEXT NOT NULL,
  entidad TEXT,
  detalle JSONB,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.auditoria TO authenticated;
GRANT ALL ON public.auditoria TO service_role;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auditoria read admin" ON public.auditoria FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Auditoria insert staff" ON public.auditoria FOR INSERT TO authenticated WITH CHECK (true);

-- SEED RUTAS
INSERT INTO public.rutas (nombre, dia) VALUES ('Ruta Miércoles', 'miercoles'), ('Ruta Sábado', 'sabado');

-- SEED CATEGORIAS
INSERT INTO public.categorias (nombre) VALUES ('Lácteos'), ('Carnes'), ('Hogar');

-- SEED PRODUCTOS
INSERT INTO public.productos (codigo, nombre, categoria_id, precio, costo, existencia, existencia_minima)
SELECT v.codigo, v.nombre, c.id, v.precio, 0, 0, 5
FROM (VALUES
  ('L001','Queso Semiduro Kilo', 4000, 'Lácteos'),
  ('L002','Queso Semiduro Medio Kilo', 2000, 'Lácteos'),
  ('L003','Queso Ratón Kilo', 4000, 'Lácteos'),
  ('L004','Queso Ratón Medio Kilo', 2000, 'Lácteos'),
  ('L005','Natilla', 1000, 'Lácteos'),
  ('L006','Cuajada', 1000, 'Lácteos'),
  ('L007','Yogurt Fresa', 2500, 'Lácteos'),
  ('L008','Yogurt Frutas', 2500, 'Lácteos'),
  ('L009','Yogurt Natural', 2500, 'Lácteos'),
  ('L010','Yogurt Piña y Coco', 2500, 'Lácteos'),
  ('L011','Leche de Cabra 1 Litro', 2000, 'Lácteos'),
  ('L012','Leche Fresca 1.5 Litros', 1300, 'Lácteos'),
  ('L013','Leche Fresca 3 Litros', 3000, 'Lácteos'),
  ('L014','Leche Agria 2.5 Litros', 2500, 'Lácteos'),
  ('L015','Queso Rayado 200 gramos', 1000, 'Lácteos'),
  ('L016','Queso Rayado 500 gramos', 2500, 'Lácteos'),
  ('C001','Trocitos de Cerdo 1 Kilo', 3500, 'Carnes'),
  ('C002','Chuleta de Cerdo 1 Kilo', 3500, 'Carnes'),
  ('H001','Almohada Unidad', 5000, 'Hogar')
) AS v(codigo, nombre, precio, categoria)
JOIN public.categorias c ON c.nombre = v.categoria;
