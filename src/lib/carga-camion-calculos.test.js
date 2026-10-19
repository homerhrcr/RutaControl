import { expect, test } from "bun:test";
import { disponibleCamion, sumarProductos, validarVentaCamion } from "./carga-camion-calculos";
const leche = { producto_id: "leche", preventa: 5, extra: 10, vendido: 0, devuelto: 0, merma: 0 };
test("preventa 5 más extras 10 carga 15 unidades a bordo", () => {
  expect(disponibleCamion(leche)).toBe(15);
});
test("venta duplicada de 2 más 3 consume 5 unidades", () => {
  expect(sumarProductos([{ producto_id: "leche", cantidad: 2 }, { producto_id: "leche", cantidad: 3 }]).get("leche")).toBe(5);
});
test("no se permite vender más que el inventario del camión", () => {
  expect(validarVentaCamion([leche], [{ producto_id: "leche", cantidad: 16 }])).toBe(false);
  expect(validarVentaCamion([leche], [{ producto_id: "leche", cantidad: 15 }])).toBe(true);
});
test("cierre con 6 vendidos y 2 dañados devuelve 7 a bodega y deja cero a bordo", () => {
  expect(disponibleCamion({ ...leche, vendido: 6, merma: 2 })).toBe(7);
  expect(disponibleCamion({ ...leche, vendido: 6, merma: 2, devuelto: 7 })).toBe(0);
});
import { reservasPedidos as rp, validarVentaCamion as vv } from "./carga-camion-calculos";
test("producto reservado para pedido no se puede vender directo", () => {
  const pedidos = [{ id: "p1", estado: "cargado", pedidos_detalle: [{ producto_id: "a", cantidad: 3 }] }];
  const det = (exc) => [{ producto_id: "a", preventa: 3, extra: 2, vendido: 0, devuelto: 0, merma: 0, reservado: rp(pedidos, exc).get("a") ?? 0 }];
  expect(vv(det(), [{ producto_id: "a", cantidad: 2 }])).toBe(true);
  expect(vv(det(), [{ producto_id: "a", cantidad: 3 }])).toBe(false);
  expect(vv(det(new Set(["p1"])), [{ producto_id: "a", cantidad: 5 }])).toBe(true);
});
