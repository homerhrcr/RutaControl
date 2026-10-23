type PedidoHistorico = {
  estado: string;
  fecha_entrega: string;
  ventas?: { fecha: string } | null;
};

export function pedidoEntregado(pedido: PedidoHistorico) {
  return pedido.estado === "entregado";
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

export function agruparEntregados<T extends PedidoHistorico>(pedidos: T[]) {
  const grupos = new Map<string, T[]>();
  for (const pedido of pedidos) {
    if (!pedidoEntregado(pedido)) continue;
    const fecha = fechaEntregaHistorico(pedido);
    const grupo = grupos.get(fecha) ?? [];
    grupo.push(pedido);
    grupos.set(fecha, grupo);
  }
  return [...grupos.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([fecha, pedidos]) => ({ fecha, pedidos }));
}