ALTER TABLE public.user_active_sessions DROP CONSTRAINT user_active_sessions_pkey;
ALTER TABLE public.user_active_sessions ADD CONSTRAINT user_active_sessions_pkey PRIMARY KEY (user_id, device_token);

CREATE OR REPLACE FUNCTION public.reclamar_sesion(p_tipo text, p_token text, p_user_agent text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF p_tipo NOT IN ('computadora','movil') OR coalesce(length(p_token),0) < 16 THEN
    RAISE EXCEPTION 'Datos inválidos';
  END IF;
  INSERT INTO public.user_active_sessions(user_id, tipo_dispositivo, device_token, user_agent)
  VALUES (auth.uid(), p_tipo, p_token, left(p_user_agent, 300))
  ON CONFLICT (user_id, device_token)
  DO UPDATE SET tipo_dispositivo = EXCLUDED.tipo_dispositivo, user_agent = EXCLUDED.user_agent, updated_at = now();
  -- Conservar solo los 2 dispositivos más recientes
  DELETE FROM public.user_active_sessions s
  WHERE s.user_id = auth.uid()
    AND s.device_token NOT IN (
      SELECT device_token FROM public.user_active_sessions
      WHERE user_id = auth.uid() ORDER BY updated_at DESC LIMIT 2);
END $function$;

CREATE OR REPLACE FUNCTION public.sesion_vigente(p_tipo text, p_token text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN public.is_platform_admin(auth.uid()) THEN true
    WHEN NOT EXISTS (SELECT 1 FROM public.user_active_sessions WHERE user_id = auth.uid()) THEN true
    ELSE EXISTS (SELECT 1 FROM public.user_active_sessions WHERE user_id = auth.uid() AND device_token = p_token)
  END
$function$;