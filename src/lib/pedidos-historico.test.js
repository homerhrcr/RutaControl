import { expect, test } from "bun:test";
import { agruparEntregados, fechaEntregaHistorico, pedidoEntregado } from "./pedidos-historico";

test("las entregadas salen de preventa y solo ellas pasan al histórico", () => {
  const pedidos = ["borrador", "confirmado", "cargado", "entregado", "cancelado"].map((estado) => ({ estado, fecha_entrega: "2026-10-22" }));
  expect(pedidos.filter((p) => !pedidoEntregado(p)).map((p) => p.estado)).toEqual(["borrador", "confirmado", "cargado", "cancelado"]);
  expect(agruparEntregados(pedidos)[0].pedidos.map((p) => p.estado)).toEqual(["entregado"]);
});

test("carpetas por fecha real de entrega, recientes primero y sin duplicados", () => {
  const grupos = agruparEntregados([
    { id: "a", estado: "entregado", fecha_entrega: "2026-10-20", ventas: { fecha: "2026-10-23T00:32:00Z" } },
    { id: "b", estado: "entregado", fecha_entrega: "2026-10-21" },
    { id: "c", estado: "entregado", fecha_entrega: "2026-10-22" },
  ]);
  expect(grupos.map((g) => [g.fecha, g.pedidos.map((p) => p.id)])).toEqual([["2026-10-22", ["a", "c"]], ["2026-10-21", ["b"]]]);
});

test("pedidos antiguos sin venta mantienen su fecha de entrega registrada", () => {
  expect(fechaEntregaHistorico({ estado: "entregado", fecha_entrega: "2026-10-22", ventas: null })).toBe("2026-10-22");
});