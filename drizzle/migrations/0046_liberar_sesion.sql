CREATE OR REPLACE FUNCTION public.liberar_sesion(p_token text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.user_active_sessions WHERE user_id = auth.uid() AND device_token = p_token;
$$;
REVOKE ALL ON FUNCTION public.liberar_sesion(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.liberar_sesion(text) TO authenticated;