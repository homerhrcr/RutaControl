/** El catálogo llega ordenado por el orden manual guardado; no priorizar nombres, reservas ni cantidades. */
export function ordenarSegunCatalogo<T>(
  filas: readonly T[],
  catalogo: readonly { id: string }[],
  productoId: (fila: T) => string,
): T[] {
  const posiciones = new Map(catalogo.map((p, i) => [p.id, i]));
  return [...filas].sort((a, b) =>
    (posiciones.get(productoId(a)) ?? catalogo.length) -
    (posiciones.get(productoId(b)) ?? catalogo.length),
  );
}