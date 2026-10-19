/** Move one client to a one-based position without changing the other clients' relative order. */
export function moverAPosicion<T extends { id: string }>(items: T[], id: string, posicion: number): T[] {
  const origen = items.findIndex((item) => item.id === id);
  if (origen < 0 || !Number.isInteger(posicion) || items.length === 0) return items;
  const destino = Math.max(0, Math.min(items.length - 1, posicion - 1));
  if (origen === destino) return items;
  const next = [...items];
  const [item] = next.splice(origen, 1);
  if (!item) return items;
  next.splice(destino, 0, item);
  return next;
}