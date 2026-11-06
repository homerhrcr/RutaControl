ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS medio_pago text, ADD COLUMN IF NOT EXISTS referencia_pago text;
ALTER TABLE public.abonos ADD COLUMN IF NOT EXISTS medio_pago text, ADD COLUMN IF NOT EXISTS referencia_pago text;
ALTER TABLE public.catalogo_opciones DROP CONSTRAINT catalogo_opciones_catalogo_chk;
ALTER TABLE public.catalogo_opciones ADD CONSTRAINT catalogo_opciones_catalogo_chk CHECK (catalogo = ANY (ARRAY['motivo_devolucion','destino_devolucion','tipo_identificacion','tarifa_iva','metodo_pago','motivo_cancelacion_pedido','categoria_gasto_planta','medio_pago']));
INSERT INTO public.catalogo_opciones (organization_id, catalogo, codigo, etiqueta, orden, predeterminado)
SELECT o.id, 'medio_pago', c.n, c.n, c.i, c.i = 1
FROM public.organizations o
CROSS JOIN unnest(ARRAY['Efectivo','SINPE Móvil','Transferencia bancaria','Tarjeta / Datáfono','Cheque']) WITH ORDINALITY AS c(n, i)
ON CONFLICT (organization_id, catalogo, codigo) DO NOTHING;

CREATE OR REPLACE FUNCTION public.trg_sembrar_medio_pago() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.catalogo_opciones (organization_id, catalogo, codigo, etiqueta, orden, predeterminado)
  SELECT NEW.id, 'medio_pago', c.n, c.n, c.i, c.i = 1
  FROM unnest(ARRAY['Efectivo','SINPE Móvil','Transferencia bancaria','Tarjeta / Datáfono','Cheque']) WITH ORDINALITY AS c(n, i)
  ON CONFLICT (organization_id, catalogo, codigo) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sembrar_medio_pago AFTER INSERT ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.trg_sembrar_medio_pago();

CREATE OR REPLACE FUNCTION public.registrar_pago_venta(p_venta uuid, p_medio text, p_referencia text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE org uuid := public.current_organization_id(); uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT public.is_staff(uid) OR org IS NULL THEN RAISE EXCEPTION 'No autorizado'; END IF;
  UPDATE ventas SET medio_pago = NULLIF(btrim(left(p_medio, 80)), ''), referencia_pago = NULLIF(btrim(left(p_referencia, 120)), '')
  WHERE id = p_venta AND organization_id = org AND (vendedor_id = uid OR public.is_admin(uid));
END $$;
REVOKE ALL ON FUNCTION public.registrar_pago_venta(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_pago_venta(uuid, text, text) TO authenticated;