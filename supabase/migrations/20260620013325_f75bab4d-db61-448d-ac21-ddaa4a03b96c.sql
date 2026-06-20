CREATE OR REPLACE FUNCTION public.log_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_row := to_jsonb(OLD);
  ELSE
    v_row := to_jsonb(NEW);
  END IF;

  INSERT INTO public.auditoria (usuario_id, accion, entidad, detalle)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    jsonb_build_object(
      'op', TG_OP,
      'nuevo', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
      'anterior', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END
    )
  );

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auditoria_ventas ON public.ventas;
CREATE TRIGGER auditoria_ventas
  AFTER INSERT OR UPDATE OR DELETE ON public.ventas
  FOR EACH ROW EXECUTE FUNCTION public.log_auditoria();

DROP TRIGGER IF EXISTS auditoria_abonos ON public.abonos;
CREATE TRIGGER auditoria_abonos
  AFTER INSERT OR UPDATE OR DELETE ON public.abonos
  FOR EACH ROW EXECUTE FUNCTION public.log_auditoria();