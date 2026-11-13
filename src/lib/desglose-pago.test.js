import { test, expect } from "bun:test";
import { desglosarMedio } from "./pago-mixto.ts";
test("efectivo y SINPE se separan", () => {
  expect(desglosarMedio("Efectivo", 5000)).toEqual({ efectivo: 5000, electronico: 0 });
  expect(desglosarMedio("SINPE Móvil", 5000)).toEqual({ efectivo: 0, electronico: 5000 });
});
test("pago mixto se reparte por monto", () => {
  expect(desglosarMedio("Mixto: Efectivo ₡17 697 + SINPE Móvil ₡1 900", 19597)).toEqual({ efectivo: 17697, electronico: 1900 });
});
