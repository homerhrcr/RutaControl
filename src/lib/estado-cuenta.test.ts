import { expect, test } from "vitest";
import { calcularEstadoCuenta } from "./estado-cuenta";

test("compra de contado cuenta como pagada y no deja saldo", () => {
  const e = calcularEstadoCuenta([{ fecha: "2026-11-05T10:00:00Z", total: 10300, metodo_pago: "contado", detalle_ventas: [] }], [], []);
  expect(e.compras).toBe(10300);
  expect(e.pagado).toBe(10300);
  expect(e.saldo).toBe(0);
});

test("saldo pendiente sale solo de créditos vivos y abonos suman a pagado", () => {
  const e = calcularEstadoCuenta(
    [{ fecha: "2026-11-05T10:00:00Z", total: 5000, metodo_pago: "credito", detalle_ventas: [] }],
    [{ fecha: "2026-11-06T10:00:00Z", monto: 2000 }],
    [{ saldo: 3000 }],
  );
  expect(e.pagado).toBe(2000);
  expect(e.saldo).toBe(3000);
});
