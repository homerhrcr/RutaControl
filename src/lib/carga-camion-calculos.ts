export type ExistenciaCamion = { producto_id: string; preventa: number; extra: number; vendido: number; devuelto: number; merma: number };
export function disponibleCamion(d: ExistenciaCamion) {
  return Number(d.preventa) + Number(d.extra) - Number(d.vendido) - Number(d.devuelto) - Number(d.merma);
}
export function sumarProductos(items: { producto_id: string; cantidad: number }[]) {
  const cantidades = new Map<string, number>();
  for (const i of items) cantidades.set(i.producto_id, (cantidades.get(i.producto_id) ?? 0) + Number(i.cantidad));
  return cantidades;
}
export function validarVentaCamion(detalle: ExistenciaCamion[], items: { producto_id: string; cantidad: number }[]) {
  for (const [id, cantidad] of sumarProductos(items)) {
    const d = detalle.find((x) => x.producto_id === id);
    if (!Number.isFinite(cantidad) || cantidad <= 0 || !d || cantidad > disponibleCamion(d)) return false;
  }
  return items.length > 0;
}