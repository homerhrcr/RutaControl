/** Valora toda la carga con los precios vigentes de su ruta, nunca con el catálogo general. */
export function estimarCarga(
  detalle: { producto_id: string; preventa: number; extra: number }[],
  productos: { id: string; costo: number }[],
  precios: { id: string; precio: number; precioInfo: { valido: boolean } }[],
) {
  const filas = detalle.map((d) => {
    const cantidad = Number(d.preventa) + Number(d.extra);
    const costo = Number(productos.find((p) => p.id === d.producto_id)?.costo ?? 0);
    const p = precios.find((p) => p.id === d.producto_id);
    const venta = p?.precioInfo.valido ? Number(p.precio) : null;
    return { producto_id: d.producto_id, costo, costoTotal: costo * cantidad, venta, ventaTotal: venta === null ? null : venta * cantidad };
  });
  const faltantes = filas.filter((f) => f.venta === null).map((f) => f.producto_id);
  const costoTotal = filas.reduce((s, f) => s + f.costoTotal, 0);
  const ventaTotal = faltantes.length ? null : filas.reduce((s, f) => s + (f.ventaTotal ?? 0), 0);
  return { filas, faltantes, costoTotal, ventaTotal, utilidad: ventaTotal === null ? null : ventaTotal - costoTotal };
}