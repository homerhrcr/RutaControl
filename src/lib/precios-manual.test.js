import { expect, test } from "bun:test";
import { aplicarPrecioManual } from "./precios";

const linea = { producto_id: "salchichon", nombre: "Salchichón", precio: 3000, cantidad: 1 };

test("un vendedor sube o baja el precio solo en la línea y queda el original registrado", () => {
  const r = aplicarPrecioManual(linea, 2800, "Acuerdo con el cliente");
  expect(r.precio).toBe(2800);
  expect(r.precioOriginal).toBe(3000);
  expect(r.precioModificado).toBe(true);
  expect(r.motivoModificacion).toBe("Acuerdo con el cliente");
  expect(aplicarPrecioManual(linea, 3200, "Corte especial").precio).toBe(3200);
});

test("el precio original se conserva en una segunda modificación", () => {
  const r2 = aplicarPrecioManual(aplicarPrecioManual(linea, 2800, "Primera"), 2700, "Segunda");
  expect(r2.precioOriginal).toBe(3000);
  expect(r2.precio).toBe(2700);
});

test("exige motivo y un precio válido (positivo o cero, máximo dos decimales)", () => {
  expect(() => aplicarPrecioManual(linea, 2800, "  ")).toThrow();
  expect(() => aplicarPrecioManual(linea, -1, "Motivo")).toThrow();
  expect(() => aplicarPrecioManual(linea, 1.234, "Motivo")).toThrow();
});

test("la línea original no se muta: la lista de precios queda intacta", () => {
  aplicarPrecioManual(linea, 2800, "Motivo");
  expect(linea.precio).toBe(3000);
  expect(linea.precioModificado).toBeUndefined();
});
