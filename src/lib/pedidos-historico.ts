type PedidoHistorico = {
  estado: string;
  fecha_entrega: string;
  ventas?: { fecha: string } | null;
};

export function pedidoEntregado(pedido: PedidoHistorico) {
  return pedido.estado === "entregado";
}

// El histórico guarda lo que ya no está pendiente: entregado, cancelado o anulado.
export function pedidoEnHistorico(pedido: PedidoHistorico) {
  return pedidoEntregado(pedido) || pedido.estado === "cancelado" || pedido.estado === "anulado";
}

export function fechaEntregaHistorico(pedido: PedidoHistorico) {
  const fecha = pedido.ventas?.fecha;
  if (!fecha) return pedido.fecha_entrega;
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
  const instante = new Date(fecha);
  if (Number.isNaN(instante.getTime())) return pedido.fecha_entrega;
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Costa_Rica", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(instante);
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

export function agruparHistorico<T extends PedidoHistorico>(pedidos: T[]) {
  const grupos = new Map<string, T[]>();
  for (const pedido of pedidos) {
    if (!pedidoEnHistorico(pedido)) continue;
    const fecha = fechaEntregaHistorico(pedido);
    const grupo = grupos.get(fecha) ?? [];
    grupo.push(pedido);
    grupos.set(fecha, grupo);
  }
  return [...grupos.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([fecha, pedidos]) => ({ fecha, pedidos }));
}

export function etiquetaHistorico(pedidos: PedidoHistorico[]) {
  const entregados = pedidos.filter(pedidoEntregado).length;
  const cancelados = pedidos.length - entregados;
  const partes = [`${entregados} entregado${entregados === 1 ? "" : "s"}`];
  if (cancelados) partes.push(`${cancelados} cancelado${cancelados === 1 ? "" : "s"}`);
  return partes.join(" · ");
}
