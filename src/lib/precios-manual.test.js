import { expect, test } from "bun:test";
import { aplicarPrecioManual } from "./precios";

const linea = { producto_id: "queso", nombre: "Queso", precio: 3800, cantidad: 2 };

test("un vendedor no puede modificar el precio manualmente", () => {
  expect(() => aplicarPrecioManual(linea, 3500, "Autorizado por gerencia", false)).toThrow();
});

test("un administrador modifica el precio y queda el original registrado", () => {
  const r = aplicarPrecioManual(linea, 3500, "Autorizado por gerencia", true);
  expect(r.precio).toBe(3500);
  expect(r.precioOriginal).toBe(3800);
  expect(r.precioModificado).toBe(true);
  expect(r.motivoModificacion).toBe("Autorizado por gerencia");
});

test("el precio original se conserva en una segunda modificación", () => {
  const r1 = aplicarPrecioManual(linea, 3500, "Primera", true);
  const r2 = aplicarPrecioManual(r1, 3400, "Segunda", true);
  expect(r2.precioOriginal).toBe(3800);
  expect(r2.precio).toBe(3400);
});

test("exige motivo y un precio válido (positivo o cero, máximo dos decimales)", () => {
  expect(() => aplicarPrecioManual(linea, 3500, "  ", true)).toThrow();
  expect(() => aplicarPrecioManual(linea, -1, "Motivo", true)).toThrow();
  expect(() => aplicarPrecioManual(linea, 1.234, "Motivo", true)).toThrow();
});

test("la línea original no se muta: catálogo y listas quedan intactos", () => {
  aplicarPrecioManual(linea, 3500, "Motivo", true);
  expect(linea.precio).toBe(3800);
  expect(linea.precioModificado).toBeUndefined();
});
