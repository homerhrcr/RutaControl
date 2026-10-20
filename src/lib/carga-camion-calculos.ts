export type ExistenciaCamion = { producto_id: string; preventa: number; extra: number; vendido: number; devuelto: number; merma: number; reservado?: number };
/** Unidades físicamente a bordo (sin descontar reservas). */
export function enCamion(d: ExistenciaCamion) {
  return Number(d.preventa) + Number(d.extra) - Number(d.vendido) - Number(d.devuelto) - Number(d.merma);
}
/** Unidades libres para vender: a bordo menos lo reservado para pedidos pendientes. */
export function disponibleCamion(d: ExistenciaCamion) {
  return Math.max(0, enCamion(d) - Number(d.reservado ?? 0));
}
export function sumarProductos(items: { producto_id: string; cantidad: number }[]) {
  const cantidades = new Map<string, number>();
  for (const i of items) cantidades.set(i.producto_id, (cantidades.get(i.producto_id) ?? 0) + Number(i.cantidad));
  return cantidades;
}
type PedidoCarga = { id: string; estado: string; venta_id?: string | null; pedidos_detalle?: { producto_id: string; cantidad: number }[] | null };
/** Cantidades reservadas por pedidos pendientes de la carga, excluyendo los ids indicados (el pedido que se entrega o entregas offline). */
export function reservasPedidos(pedidos: PedidoCarga[], excluir: Set<string> = new Set()) {
  return sumarProductos(
    pedidos
      .filter((p) => !["entregado", "anulado"].includes(p.estado) && !excluir.has(p.id) && !(p.venta_id && excluir.has(p.venta_id)))
      .flatMap((p) => p.pedidos_detalle ?? []),
  );
}
export function validarVentaCamion(detalle: ExistenciaCamion[], items: { producto_id: string; cantidad: number }[]) {
  for (const [id, cantidad] of sumarProductos(items)) {
    const d = detalle.find((x) => x.producto_id === id);
    if (!Number.isFinite(cantidad) || cantidad <= 0 || !d || cantidad > disponibleCamion(d)) return false;
  }
  return items.length > 0;
}

/** Una venta de ruta nunca puede caer al inventario de bodega. */
export function validarVentaRuta(
  carga: { id: string; ruta_id: string | null; estado: string } | null | undefined,
  rutaId: string | null | undefined,
  detalle: ExistenciaCamion[],
  items: { producto_id: string; cantidad: number }[],
) {
  return !!(carga?.id && rutaId && carga.ruta_id === rutaId && carga.estado === "en_ruta")
    && validarVentaCamion(detalle, items);
}
