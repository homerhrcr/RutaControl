CREATE TABLE public.user_active_sessions (
  user_id uuid NOT NULL,
  tipo_dispositivo text NOT NULL CHECK (tipo_dispositivo IN ('computadora','movil')),
  device_token text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tipo_dispositivo)
);
GRANT SELECT ON public.user_active_sessions TO authenticated;
GRANT ALL ON public.user_active_sessions TO service_role;
ALTER TABLE public.user_active_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ver mis sesiones" ON public.user_active_sessions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.reclamar_sesion(p_tipo text, p_token text, p_user_agent text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_tipo NOT IN ('computadora','movil') OR coalesce(length(p_token),0) < 16 THEN
    RAISE EXCEPTION 'Datos inválidos';
  END IF;
  INSERT INTO public.user_active_sessions(user_id, tipo_dispositivo, device_token, user_agent)
  VALUES (auth.uid(), p_tipo, p_token, left(p_user_agent, 300))
  ON CONFLICT (user_id, tipo_dispositivo)
  DO UPDATE SET device_token = EXCLUDED.device_token, user_agent = EXCLUDED.user_agent, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.sesion_vigente(p_tipo text, p_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN public.is_platform_admin(auth.uid()) THEN true
    ELSE coalesce((SELECT device_token = p_token FROM public.user_active_sessions
                   WHERE user_id = auth.uid() AND tipo_dispositivo = p_tipo), true)
  END
$$;

REVOKE ALL ON FUNCTION public.reclamar_sesion(text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sesion_vigente(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reclamar_sesion(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sesion_vigente(text,text) TO authenticated;