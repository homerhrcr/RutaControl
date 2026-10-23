import { expect, test } from "bun:test";
import { agruparHistorico, etiquetaHistorico, fechaEntregaHistorico, pedidoEntregado, pedidoEnHistorico } from "./pedidos-historico";

test("entregados, cancelados y anulados van al histórico; pendientes se quedan en preventa", () => {
  const pedidos = ["borrador", "confirmado", "cargado", "entregado", "cancelado", "anulado"].map((estado) => ({ estado, fecha_entrega: "2026-10-22" }));
  expect(pedidos.filter((p) => !pedidoEnHistorico(p)).map((p) => p.estado)).toEqual(["borrador", "confirmado", "cargado"]);
  expect(pedidos.filter(pedidoEntregado).map((p) => p.estado)).toEqual(["entregado"]);
});

test("carpetas por fecha real de entrega, recientes primero y sin duplicados", () => {
  const grupos = agruparHistorico([
    { id: "a", estado: "entregado", fecha_entrega: "2026-10-20", ventas: { fecha: "2026-10-23T00:32:00Z" } },
    { id: "b", estado: "entregado", fecha_entrega: "2026-10-21" },
    { id: "c", estado: "entregado", fecha_entrega: "2026-10-22" },
    { id: "d", estado: "cancelado", fecha_entrega: "2026-10-22" },
  ]);
  expect(grupos.map((g) => [g.fecha, g.pedidos.map((p) => p.id)])).toEqual([["2026-10-22", ["a", "c", "d"]], ["2026-10-21", ["b"]]]);
});

test("pedidos antiguos sin venta mantienen su fecha de entrega registrada", () => {
  expect(fechaEntregaHistorico({ estado: "entregado", fecha_entrega: "2026-10-22", ventas: null })).toBe("2026-10-22");
  expect(fechaEntregaHistorico({ estado: "cancelado", fecha_entrega: "2026-10-22", ventas: null })).toBe("2026-10-22");
});

test("la carpeta distingue entregados de cancelados", () => {
  expect(etiquetaHistorico([
    { estado: "entregado", fecha_entrega: "2026-10-22" },
    { estado: "entregado", fecha_entrega: "2026-10-22" },
    { estado: "cancelado", fecha_entrega: "2026-10-22" },
    { estado: "anulado", fecha_entrega: "2026-10-22" },
  ])).toBe("2 entregados · 2 cancelados");
  expect(etiquetaHistorico([{ estado: "entregado", fecha_entrega: "2026-10-22" }])).toBe("1 entregado");
});
