import { z } from "zod";

export const recomendacionSchema = z.object({
  destino: z.enum(["reingreso", "merma"]),
  razon: z.string(),
  observaciones: z.string(),
  requiere_revision: z.boolean(),
});
export type RecomendacionDevolucion = z.infer<typeof recomendacionSchema>;

export const analisisInputSchema = z.object({
  organization_id: z.string().uuid(),
  producto_id: z.string().uuid(),
  descripcion: z.string().trim().min(3).max(2000),
  imagen: z.string().max(4_500_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/),
});

export function normalizarRecomendacion(value: unknown): RecomendacionDevolucion {
  const r = recomendacionSchema.parse(value);
  return {
    ...r,
    // Un producto dudoso no se recomienda como vendible.
    destino: r.requiere_revision ? "merma" : r.destino,
    razon: r.razon.slice(0, 800),
    observaciones: r.observaciones.slice(0, 800),
  };
}