import { describe, expect, test } from "bun:test";
import { analisisInputSchema, normalizarRecomendacion } from "./devolucion-ai";

describe("recomendaciones de devoluciones", () => {
  test("recomienda merma cuando se requiere revisión aunque el modelo sugiera reingreso", () => {
    expect(normalizarRecomendacion({ destino: "reingreso", razon: "Falta fecha", observaciones: "Sin cadena de frío", requiere_revision: true }).destino).toBe("merma");
  });
  test("conserva reingreso sin alertas de revisión", () => {
    expect(normalizarRecomendacion({ destino: "reingreso", razon: "Sellado", observaciones: "Conservación confirmada", requiere_revision: false }).destino).toBe("reingreso");
  });
  test("rechaza enlaces externos y archivos que no son fotos", () => {
    expect(analisisInputSchema.safeParse({ organization_id: "00000000-0000-4000-8000-000000000001", producto_id: "00000000-0000-4000-8000-000000000002", descripcion: "Sellado", imagen: "https://example.com/private" }).success).toBe(false);
  });
});