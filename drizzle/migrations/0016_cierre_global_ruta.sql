ALTER TABLE public.creditos ADD COLUMN IF NOT EXISTS ruta_id uuid REFERENCES public.rutas(id);

CREATE TABLE public.cierres_ruta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_organization_id() REFERENCES public.organizations(id),
  carga_id uuid REFERENCES public.cargas_camion(id),
  ruta_id uuid NOT NULL REFERENCES public.rutas(id),
  venta_id uuid REFERENCES public.ventas(id),
  credito_id uuid REFERENCES public.creditos(id),
  fecha date NOT NULL DEFAULT current_date,
  total_vendido numeric NOT NULL,
  contado numeric NOT NULL,
  credito numeric NOT NULL,
  diferencia numeric NOT NULL,
  notas text,
  usuario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cierres_ruta TO authenticated;
GRANT ALL ON public.cierres_ruta TO service_role;
ALTER TABLE public.cierres_ruta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cierres_ruta_org" ON public.cierres_ruta AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id()) WITH CHECK (organization_id = public.current_organization_id());
CREATE POLICY "cierres_ruta_staff_select" ON public.cierres_ruta FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.cierre_global_ruta(p jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE org uuid:=public.current_organization_id(); uid uuid:=auth.uid(); cid uuid:=(p->>'carga_id')::uuid; c public.cargas_camion;
  vid uuid:=gen_random_uuid(); crid uuid; r record; it jsonb; disp numeric; sob numeric; mer numeric; vend numeric; precio numeric;
  total_v numeric:=0; contado numeric:=COALESCE((p->>'contado')::numeric,0); cred numeric:=COALESCE((p->>'credito')::numeric,0); mermas jsonb:='[]'; cierre uuid;
BEGIN
  IF uid IS NULL OR org IS NULL OR NOT public.is_admin(uid) THEN RAISE EXCEPTION 'Solo administradores pueden cerrar la ruta'; END IF;
  IF contado<0 OR cred<0 THEN RAISE EXCEPTION 'Montos inválidos'; END IF;
  SELECT * INTO c FROM cargas_camion WHERE id=cid AND organization_id=org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Carga no encontrada'; END IF;
  IF c.estado<>'en_ruta' THEN RAISE EXCEPTION 'Esta carga ya está cerrada'; END IF;
  INSERT INTO ventas(id,organization_id,cliente_id,ruta_id,vendedor_id,subtotal,descuento,total,metodo_pago,carga_id)
    VALUES(vid,org,NULL,c.ruta_id,c.vendedor_id,0,0,0,CASE WHEN cred>0 THEN 'credito' ELSE 'contado' END::metodo_pago,cid);
  FOR r IN SELECT * FROM cargas_camion_detalle WHERE carga_id=cid ORDER BY producto_id FOR UPDATE LOOP
    disp:=r.preventa+r.extra-r.vendido-r.devuelto-r.merma;
    SELECT x INTO it FROM jsonb_array_elements(COALESCE(p->'items','[]')) x WHERE (x->>'producto_id')::uuid=r.producto_id LIMIT 1;
    sob:=COALESCE((it->>'sobrante')::numeric,0); mer:=COALESCE((it->>'merma')::numeric,0); precio:=(it->>'precio')::numeric;
    IF sob<0 OR mer<0 OR sob+mer>disp THEN RAISE EXCEPTION 'Sobrante y merma de % superan lo que quedó en el camión', r.nombre_producto; END IF;
    vend:=disp-sob-mer;
    IF vend>0 THEN
      IF precio IS NULL OR precio<0 THEN RAISE EXCEPTION 'Falta el precio de %', r.nombre_producto; END IF;
      INSERT INTO detalle_ventas(organization_id,venta_id,producto_id,nombre_producto,cantidad,precio_unitario,total_linea)
        VALUES(org,vid,r.producto_id,r.nombre_producto,vend,precio,vend*precio);
      UPDATE cargas_camion_detalle SET vendido=vendido+vend WHERE id=r.id;
      total_v:=total_v+vend*precio;
    END IF;
    IF mer>0 THEN mermas:=mermas||jsonb_build_array(jsonb_build_object('producto_id',r.producto_id,'cantidad',mer)); END IF;
  END LOOP;
  IF total_v=0 THEN DELETE FROM ventas WHERE id=vid; vid:=NULL;
  ELSE UPDATE ventas SET subtotal=total_v,total=total_v WHERE id=vid; END IF;
  IF cred>0 THEN
    INSERT INTO creditos(organization_id,venta_id,cliente_id,ruta_id,monto,saldo,estado,fecha_limite)
      VALUES(org,vid,NULL,c.ruta_id,cred,cred,'al_dia',current_date+30) RETURNING id INTO crid;
  END IF;
  INSERT INTO cierres_ruta(organization_id,carga_id,ruta_id,venta_id,credito_id,fecha,total_vendido,contado,credito,diferencia,notas,usuario_id)
    VALUES(org,cid,c.ruta_id,vid,crid,c.fecha,total_v,contado,cred,contado+cred-total_v,p->>'notas',uid) RETURNING id INTO cierre;
  PERFORM public.cerrar_carga_camion(jsonb_build_object('id',cid,'notas',concat_ws(' · ','Cierre global de ruta',p->>'notas'),'mermas',mermas));
  RETURN cierre;
END $$;
REVOKE ALL ON FUNCTION public.cierre_global_ruta(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cierre_global_ruta(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.abonar_credito_ruta(p jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE org uuid:=public.current_organization_id(); uid uuid:=auth.uid(); aid uuid:=(p->>'id')::uuid; m numeric:=(p->>'monto')::numeric; cr public.creditos;
BEGIN
  IF uid IS NULL OR org IS NULL OR NOT public.is_admin(uid) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF EXISTS(SELECT 1 FROM abonos WHERE id=aid) THEN RETURN; END IF;
  SELECT * INTO cr FROM creditos WHERE id=(p->>'credito_id')::uuid AND organization_id=org AND ruta_id IS NOT NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Crédito no encontrado'; END IF;
  IF m IS NULL OR m<=0 OR m>cr.saldo THEN RAISE EXCEPTION 'El abono debe ser mayor a cero y no superar el saldo'; END IF;
  INSERT INTO abonos(id,organization_id,credito_id,cliente_id,monto,cobrador_id) VALUES(aid,org,cr.id,NULL,m,uid);
  UPDATE creditos SET saldo=saldo-m, estado=CASE WHEN saldo-m=0 THEN 'cancelado' ELSE estado END::estado_credito WHERE id=cr.id;
  INSERT INTO auditoria(organization_id,usuario_id,accion,entidad,detalle) VALUES(org,uid,'abono_credito_ruta','abonos',p);
END $$;
REVOKE ALL ON FUNCTION public.abonar_credito_ruta(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.abonar_credito_ruta(jsonb) TO authenticated;