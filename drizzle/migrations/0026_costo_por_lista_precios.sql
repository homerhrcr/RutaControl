ALTER TABLE public.precios_productos ADD COLUMN IF NOT EXISTS costo numeric(14,2) CHECK (costo IS NULL OR costo >= 0);
UPDATE public.precios_productos pp SET costo = p.costo FROM public.productos p WHERE p.id = pp.producto_id AND pp.costo IS NULL;
COMMENT ON COLUMN public.productos.costo IS 'DEPRECATED: el costo se define por lista de precios (precios_productos.costo); se usa solo como respaldo';