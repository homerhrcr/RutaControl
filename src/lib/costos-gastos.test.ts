import { describe, expect, it } from "vitest";
import { inicioSemana } from "./reportes-gerenciales";

describe("costos por semana", () => {
  it("agrupa un jueves en la semana que inicia el lunes", () => {
    expect(inicioSemana("2026-10-22T15:00:00")).toBe("2026-10-19");
  });
  it("un domingo pertenece a la semana del lunes anterior", () => {
    expect(inicioSemana("2026-10-25T10:00:00")).toBe("2026-10-19");
  });
});
