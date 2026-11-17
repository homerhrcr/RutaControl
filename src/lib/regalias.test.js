import { expect, test } from "bun:test";
import { separarRegalia } from "./precios";

const linea = { producto_id: "natilla", nombre: "Natilla", precio: 1500, cantidad: 4 };

test("regalía dentro de la venta: 1 de 4 sale a ₡0 y el resto sigue cobrado", () => {
  const { cobrada, regalia } = separarRegalia(linea, 1, "Cliente nuevo");
  expect(cobrada.cantidad).toBe(3);
  expect(cobrada.precio).toBe(1500);
  expect(regalia.precio).toBe(0);
  expect(regalia.precioOriginal).toBe(1500);
  expect(regalia.motivoModificacion).toBe("Regalía: Cliente nuevo");
});

test("la regalía exige motivo", () => {
  expect(() => separarRegalia(linea, 1, "  ")).toThrow();
});

test("no se puede regalar más de lo que hay en la línea", () => {
  expect(() => separarRegalia(linea, 5, "x")).toThrow();
});
