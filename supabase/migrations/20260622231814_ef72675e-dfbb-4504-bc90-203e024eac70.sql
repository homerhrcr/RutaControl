ALTER TABLE public.cliente_rutas ADD COLUMN IF NOT EXISTS orden integer NOT NULL DEFAULT 0;

-- Seed initial order per route based on current alphabetical client order
WITH ordered AS (
  SELECT cr.id,
         row_number() OVER (PARTITION BY cr.ruta_id ORDER BY c.nombre) AS rn
  FROM public.cliente_rutas cr
  JOIN public.clientes c ON c.id = cr.cliente_id
)
UPDATE public.cliente_rutas cr
SET orden = ordered.rn
FROM ordered
WHERE cr.id = ordered.id;