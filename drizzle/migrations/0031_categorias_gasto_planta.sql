ALTER TABLE public.catalogo_opciones DROP CONSTRAINT catalogo_opciones_catalogo_chk;
ALTER TABLE public.catalogo_opciones ADD CONSTRAINT catalogo_opciones_catalogo_chk CHECK (catalogo = ANY (ARRAY['motivo_devolucion','destino_devolucion','tipo_identificacion','tarifa_iva','metodo_pago','motivo_cancelacion_pedido','categoria_gasto_planta']));
INSERT INTO public.catalogo_opciones (organization_id, catalogo, codigo, etiqueta, orden, activo)
SELECT o.id, 'categoria_gasto_planta', c.n, c.n, c.i, true
FROM (SELECT DISTINCT organization_id AS id FROM public.finca_productos) o
CROSS JOIN unnest(ARRAY['Alimentos / Concentrado','Pastos','Peón / Salarios','Electricidad','Agua','Veterinario','Medicinas','Insumos de quesería','Mantenimiento','Combustible','Otros']) WITH ORDINALITY AS c(n, i)
ON CONFLICT (organization_id, catalogo, codigo) DO NOTHING;