import { test, expect } from "vitest";
import { costoProductoRuta } from "./costos";

const rutas = [{ id: "mie", lista_precio_id: "L1" }, { id: "jue", lista_precio_id: "L2" }, { id: "sab", lista_precio_id: null }];
const precios = [{ lista_id: "L1", producto_id: "queso", costo: 2400 }, { lista_id: "L2", producto_id: "queso", costo: 3000 }];

test("queso semiduro cuesta 2400 en miércoles y 3000 en jueves", () => {
  expect(costoProductoRuta({ productoId: "queso", rutaId: "mie", rutas, precios, costoBase: 2000 })).toBe(2400);
  expect(costoProductoRuta({ productoId: "queso", rutaId: "jue", rutas, precios, costoBase: 2000 })).toBe(3000);
});

test("sin lista o sin costo en la lista usa el costo base", () => {
  expect(costoProductoRuta({ productoId: "queso", rutaId: "sab", rutas, precios, costoBase: 2000 })).toBe(2000);
  expect(costoProductoRuta({ productoId: "leche", rutaId: "mie", rutas, precios, costoBase: 600 })).toBe(600);
});
