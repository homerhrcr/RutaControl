import { expect, test } from "bun:test";
import { disponibleCamion, sumarProductos, validarVentaCamion, validarVentaRuta } from "./carga-camion-calculos";
const leche = { producto_id: "leche", preventa: 5, extra: 10, vendido: 0, devuelto: 0, merma: 0 };
const cargaRuta = { id: "camion-guacimo", ruta_id: "guacimo", estado: "en_ruta" };
const ventaRuta = [{ producto_id: "leche", cantidad: 1 }];
test("sin camión activo se bloquea la venta de ruta, aunque haya productos", () => {
  expect(validarVentaRuta(null, "guacimo", [leche], ventaRuta)).toBe(false);
});
test("no se permite descargar un camión de otra ruta", () => {
  expect(validarVentaRuta(cargaRuta, "sixaola", [leche], ventaRuta)).toBe(false);
});
test("un camión cerrado no puede entregar una venta de ruta", () => {
  expect(validarVentaRuta({ ...cargaRuta, estado: "cerrada" }, "guacimo", [leche], ventaRuta)).toBe(false);
});
test("solo se permite vender unidades disponibles del camión de la ruta", () => {
  expect(validarVentaRuta(cargaRuta, "guacimo", [leche], ventaRuta)).toBe(true);
  expect(validarVentaRuta(cargaRuta, "guacimo", [leche], [{ producto_id: "leche", cantidad: 16 }])).toBe(false);
  expect(validarVentaRuta(cargaRuta, "guacimo", [leche], [{ producto_id: "queso", cantidad: 1 }])).toBe(false);
});
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
import { enCamion, validarMermaCamion, estadoStockCamion } from "./carga-camion-calculos";
test("14 cargadas menos 10 vendidas y 3 mermas dejan 1 disponible", () => {
  const d = { ...leche, preventa: 3, extra: 11, vendido: 10, merma: 3 };
  expect(enCamion(d)).toBe(1);
  expect(disponibleCamion(d)).toBe(1);
});
test("3 de preventa en 14 cargadas dejan 11 para venta libre", () => {
  expect(disponibleCamion({ ...leche, preventa: 3, extra: 11, reservado: 3 })).toBe(11);
});
test("una venta confirmada libera la reserva aunque el estado del pedido tarde en actualizarse", () => {
  expect(rp([{ id: "pedido", estado: "cargado", pedidos_detalle: [{ producto_id: "leche", cantidad: 3 }] }], new Set(["pedido"])).get("leche") ?? 0).toBe(0);
});
test("merma sin justificación o mayor a bordo se rechaza", () => {
  expect(validarMermaCamion(3, 4, "  ")).toBe(false);
  expect(validarMermaCamion(5, 4, "Empaque roto")).toBe(false);
  expect(validarMermaCamion(NaN, 4, "Empaque roto")).toBe(false);
  expect(validarMermaCamion(3, 4, "Empaque roto")).toBe(true);
});
test("agotado a cero y alerta roja hasta tres unidades", () => {
  expect(estadoStockCamion(0)).toBe("agotado");
  expect(estadoStockCamion(3)).toBe("bajo");
  expect(estadoStockCamion(4)).toBe("disponible");
});
test("producto reservado para pedido no se puede vender directo", () => {
  const pedidos = [{ id: "p1", estado: "cargado", pedidos_detalle: [{ producto_id: "a", cantidad: 3 }] }];
  const det = (exc) => [{ producto_id: "a", preventa: 3, extra: 2, vendido: 0, devuelto: 0, merma: 0, reservado: rp(pedidos, exc).get("a") ?? 0 }];
  expect(vv(det(), [{ producto_id: "a", cantidad: 2 }])).toBe(true);
  expect(vv(det(), [{ producto_id: "a", cantidad: 3 }])).toBe(false);
  expect(vv(det(new Set(["p1"])), [{ producto_id: "a", cantidad: 5 }])).toBe(true);
});
test("cancelar una preventa libera solo su reserva para venta libre sin aumentar el total físico", () => {
  const detalle = [{ producto_id: "leche", cantidad: 3 }];
  const otro = { id: "otro", estado: "cargado", pedidos_detalle: [{ producto_id: "leche", cantidad: 2 }] };
  const pedido = { id: "pedido", estado: "cargado", pedidos_detalle: detalle };
  const stock = { ...leche, preventa: 5, extra: 9, vendido: 4, merma: 1 };
  const antes = rp([pedido, otro]).get("leche") ?? 0;
  const despues = rp([{ ...pedido, estado: "cancelado" }, otro]).get("leche") ?? 0;
  expect(antes).toBe(5);
  expect(despues).toBe(2);
  expect(enCamion(stock)).toBe(9);
  expect(disponibleCamion({ ...stock, reservado: antes })).toBe(4);
  expect(disponibleCamion({ ...stock, reservado: despues })).toBe(7);
  expect(vv([{ ...stock, reservado: despues }], [{ producto_id: "leche", cantidad: 7 }])).toBe(true);
  expect(vv([{ ...stock, reservado: despues }], [{ producto_id: "leche", cantidad: 8 }])).toBe(false);
});
test("releer la cancelación no duplica las unidades liberadas", () => {
  const pedidos = [{ id: "cancelado", estado: "cancelado", pedidos_detalle: [{ producto_id: "leche", cantidad: 3 }] }];
  const stock = { ...leche, preventa: 3, extra: 11, vendido: 10, merma: 1 };
  for (let intento = 0; intento < 3; intento++) {
    expect(disponibleCamion({ ...stock, reservado: rp(pedidos).get("leche") ?? 0 })).toBe(3);
  }
});
