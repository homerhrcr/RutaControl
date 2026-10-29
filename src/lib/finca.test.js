import { describe, it, expect } from "vitest";
import { semanaDe, moverSemana, balanceFinca } from "./finca";

describe("Ganadera San Bosco", () => {
  it("la semana va de lunes a domingo", () => {
    expect(semanaDe("2026-10-29")).toEqual({ desde: "2026-10-26", hasta: "2026-11-01" });
    expect(semanaDe("2026-11-01")).toEqual({ desde: "2026-10-26", hasta: "2026-11-01" });
  });
  it("mover semana anterior", () => {
    expect(moverSemana("2026-10-26", -1).desde).toBe("2026-10-19");
  });
  it("utilidad = producido a precio de venta − gastos", () => {
    const b = balanceFinca([{ monto: 50000 }, { monto: 20000 }], [{ cantidad: 10, precio_unitario: 2200 }, { cantidad: 100, precio_unitario: 800 }]);
    expect(b).toEqual({ totalGastos: 70000, totalProducido: 102000, utilidad: 32000 });
  });
});
