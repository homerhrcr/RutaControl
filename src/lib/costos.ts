/** Costo unitario de un producto para una ruta: costo de la lista asignada a la ruta; respaldo al costo base heredado. */
export function costoProductoRuta(args: {
  productoId: string;
  rutaId?: string | null;
  rutas: { id: string; lista_precio_id?: string | null }[];
  precios: { lista_id: string; producto_id: string; costo?: number | string | null }[];
  costoBase?: number | string | null;
}): number {
  const lista = args.rutas.find((r) => r.id === args.rutaId)?.lista_precio_id;
  const fila = lista ? args.precios.find((p) => p.lista_id === lista && p.producto_id === args.productoId) : undefined;
  if (fila && fila.costo !== null && fila.costo !== undefined) return Number(fila.costo);
  return Number(args.costoBase ?? 0);
}
