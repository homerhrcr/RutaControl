import { describe, it, expect } from "vitest";
import { errorPartes, resumenPartes } from "./pago-mixto";

describe("pago mixto", () => {
  const partes = [
    { medio: "Efectivo", monto: "10000", referencia: "" },
    { medio: "SINPE Móvil", monto: "15000", referencia: "123" },
  ];
  it("cuadra cuando la suma es igual al total", () => {
    expect(errorPartes(partes, 25000)).toBeNull();
  });
  it("avisa cuánto falta", () => {
    expect(errorPartes(partes, 30000)).toContain("Faltan");
  });
  it("resume el desglose", () => {
    expect(resumenPartes(partes).referencia).toBe("SINPE Móvil: 123");
    expect(resumenPartes(partes).medio.startsWith("Mixto:")).toBe(true);
  });
});
