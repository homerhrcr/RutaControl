export interface PrecioLista { lista_id: string; producto_id: string; precio: number }

/** A missing override uses the base price; zero is a valid fixed price. */
export function precioCliente(producto: { id: string; precio: number }, listaId: string | null | undefined, precios: PrecioLista[]): number {
  const fijo = listaId ? precios.find((p) => p.lista_id === listaId && p.producto_id === producto.id) : undefined;
  return Number(fijo?.precio ?? producto.precio);
}

export function validarPrecio(valor: string): number | null {
  if (!valor.trim()) return null;
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0 || Math.abs(numero * 100 - Math.round(numero * 100)) > 0.000001) {
    throw new Error("El precio debe ser positivo o cero y tener como máximo dos decimales");
  }
  return numero;
}