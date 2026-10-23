ALTER TABLE public.catalogo_opciones DROP CONSTRAINT catalogo_opciones_catalogo_chk;
ALTER TABLE public.catalogo_opciones ADD CONSTRAINT catalogo_opciones_catalogo_chk CHECK (catalogo = ANY (ARRAY['motivo_devolucion','destino_devolucion','tipo_identificacion','tarifa_iva','metodo_pago','motivo_cancelacion_pedido']));
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS motivo_cancelacion text, ADD COLUMN IF NOT EXISTS cancelado_por uuid, ADD COLUMN IF NOT EXISTS cancelado_en timestamptz;
CREATE OR REPLACE FUNCTION public.sembrar_catalogo_opciones(p_org uuid)
 RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  (p_org,'metodo_pago','credito','Crédito',2,false,true),
  (p_org,'motivo_cancelacion_pedido','No contesta','Cliente no contesta',1,true,false),
  (p_org,'motivo_cancelacion_pedido','No estaba','Cliente no estaba / local cerrado',2,false,false),
  (p_org,'motivo_cancelacion_pedido','Ya no lo quiere','Cliente ya no lo quiere',3,false,false),
  (p_org,'motivo_cancelacion_pedido','Sin dinero','Cliente sin dinero para pagar',4,false,false),
  (p_org,'motivo_cancelacion_pedido','Compró a otro','Compró a otro proveedor',5,false,false),
  (p_org,'motivo_cancelacion_pedido','Sin producto','No había producto disponible',6,false,false),
  (p_org,'motivo_cancelacion_pedido','No se llegó','No se llegó a visitar (tiempo/ruta)',7,false,false),
  (p_org,'motivo_cancelacion_pedido','Dirección errónea','Dirección incorrecta / no se encontró',8,false,false),
  (p_org,'motivo_cancelacion_pedido','Duplicado','Pedido duplicado o por error',9,false,false),
  (p_org,'motivo_cancelacion_pedido','Otro','Otro',10,false,false)
  ON CONFLICT (organization_id, catalogo, codigo) DO NOTHING;
$function$;
SELECT public.sembrar_catalogo_opciones(id) FROM public.organizations;