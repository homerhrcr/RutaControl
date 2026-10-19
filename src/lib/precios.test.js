import { expect, test } from "bun:test";
import { precioCliente, validarPrecio } from "./precios";

const producto = { id: "leche", precio: 1200 };
const precios = [
  { lista_id: "jueves", producto_id: "leche", precio: 1000 },
  { lista_id: "sabado", producto_id: "leche", precio: 1100 },
  { lista_id: "supermercado", producto_id: "leche", precio: 900 },
];
test("clientes de jueves y sábado reciben precios fijos distintos", () => {
  expect(precioCliente(producto, "jueves", precios)).toBe(1000);
  expect(precioCliente(producto, "sabado", precios)).toBe(1100);
});
test("la clasificación comercial prevalece independientemente de la ruta", () => {
  expect(precioCliente(producto, "supermercado", precios)).toBe(900);
});
test("sin lista o sin precio específico usa el precio base", () => {
  expect(precioCliente(producto, null, precios)).toBe(1200);
  expect(precioCliente({ id: "queso", precio: 2000 }, "jueves", precios)).toBe(2000);
});
test("cero es un precio fijo y no dispara el precio base", () => {
  expect(precioCliente(producto, "promo", [{ lista_id: "promo", producto_id: "leche", precio: 0 }])).toBe(0);
});
test("precios no negativos con hasta dos decimales y vacío restablece base", () => {
  expect(validarPrecio("123.45")).toBe(123.45);
  expect(validarPrecio("")).toBeNull();
  expect(() => validarPrecio("-1")).toThrow();
  expect(() => validarPrecio("1.234")).toThrow();
});