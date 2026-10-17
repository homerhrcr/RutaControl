CREATE TABLE public.telegram_clientes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL DEFAULT public.current_organization_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
 cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
 chat_id bigint UNIQUE,
 telegram_nombre text,
 vinculado_en timestamptz,
 activo boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id, cliente_id)
);
GRANT SELECT ON public.telegram_clientes TO authenticated;
GRANT ALL ON public.telegram_clientes TO service_role;
ALTER TABLE public.telegram_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leer vinculos Telegram" ON public.telegram_clientes FOR SELECT TO authenticated USING(public.is_staff(auth.uid()));
CREATE POLICY "Aislar vinculos Telegram" ON public.telegram_clientes AS RESTRICTIVE FOR ALL TO authenticated USING(organization_id=public.current_organization_id()) WITH CHECK(organization_id=public.current_organization_id());
CREATE TABLE public.telegram_codigos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.telegram_codigos TO service_role;
ALTER TABLE public.telegram_codigos ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.telegram_mensajes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL DEFAULT public.current_organization_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
 cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
 direccion text NOT NULL CHECK(direccion IN ('entrada','salida')),
 texto text NOT NULL,
 estado text NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','enviando','enviado','error','incierto','recibido')),
 dedupe_key text UNIQUE,
 telegram_update_id bigint UNIQUE,
 telegram_message_id bigint,
 error text,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.telegram_mensajes TO authenticated;
GRANT ALL ON public.telegram_mensajes TO service_role;
ALTER TABLE public.telegram_mensajes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leer mensajes Telegram" ON public.telegram_mensajes FOR SELECT TO authenticated USING(public.is_staff(auth.uid()));
CREATE POLICY "Aislar mensajes Telegram" ON public.telegram_mensajes AS RESTRICTIVE FOR ALL TO authenticated USING(organization_id=public.current_organization_id()) WITH CHECK(organization_id=public.current_organization_id());
CREATE INDEX telegram_mensajes_cliente_fecha ON public.telegram_mensajes(organization_id,cliente_id,created_at DESC);
CREATE TABLE public.telegram_updates (
 update_id bigint PRIMARY KEY,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.telegram_updates TO service_role;
ALTER TABLE public.telegram_updates ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.telegram_recibir(p_update_id bigint,p_chat_id bigint,p_nombre text,p_texto text,p_token_hash text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cod public.telegram_codigos; vinc public.telegram_clientes; nueva boolean;
BEGIN
 INSERT INTO public.telegram_updates(update_id) VALUES(p_update_id) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS nueva = ROW_COUNT;
 IF NOT nueva THEN RETURN jsonb_build_object('status','duplicado'); END IF;
 IF p_token_hash IS NOT NULL THEN
  SELECT * INTO cod FROM public.telegram_codigos WHERE token_hash=p_token_hash AND consumed_at IS NULL AND expires_at>now() FOR UPDATE;
  IF cod.id IS NULL THEN RETURN jsonb_build_object('status','codigo_invalido'); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.clientes c JOIN public.organizations o ON o.id=c.organization_id WHERE c.id=cod.cliente_id AND c.organization_id=cod.organization_id AND o.estado='active') THEN RETURN jsonb_build_object('status','codigo_invalido'); END IF;
  IF EXISTS(SELECT 1 FROM public.telegram_clientes WHERE chat_id=p_chat_id AND (cliente_id<>cod.cliente_id OR organization_id<>cod.organization_id)) THEN RETURN jsonb_build_object('status','chat_ocupado'); END IF;
  IF EXISTS(SELECT 1 FROM public.telegram_clientes WHERE cliente_id=cod.cliente_id AND organization_id=cod.organization_id AND activo AND chat_id<>p_chat_id) THEN RETURN jsonb_build_object('status','cliente_ocupado'); END IF;
  INSERT INTO public.telegram_clientes(organization_id,cliente_id,chat_id,telegram_nombre,vinculado_en,activo) VALUES(cod.organization_id,cod.cliente_id,p_chat_id,left(p_nombre,100),now(),true)
   ON CONFLICT(organization_id,cliente_id) DO UPDATE SET chat_id=excluded.chat_id,telegram_nombre=excluded.telegram_nombre,vinculado_en=now(),activo=true;
  UPDATE public.telegram_codigos SET consumed_at=now() WHERE id=cod.id;
  RETURN jsonb_build_object('status','vinculado');
 END IF;
 SELECT t.* INTO vinc FROM public.telegram_clientes t JOIN public.organizations o ON o.id=t.organization_id AND o.estado='active' WHERE t.chat_id=p_chat_id AND t.activo FOR UPDATE OF t;
 IF vinc.id IS NULL THEN RETURN jsonb_build_object('status','sin_vinculo'); END IF;
 IF lower(trim(p_texto))='/stop' OR lower(trim(p_texto))='/desvincular' THEN
  UPDATE public.telegram_clientes SET activo=false,chat_id=NULL WHERE id=vinc.id;
  RETURN jsonb_build_object('status','desvinculado');
 END IF;
 INSERT INTO public.telegram_mensajes(organization_id,cliente_id,direccion,texto,estado,telegram_update_id) VALUES(vinc.organization_id,vinc.cliente_id,'entrada',left(p_texto,4096),'recibido',p_update_id);
 RETURN jsonb_build_object('status','recibido');
END; $$;
REVOKE ALL ON FUNCTION public.telegram_recibir(bigint,bigint,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_recibir(bigint,bigint,text,text,text) TO service_role;