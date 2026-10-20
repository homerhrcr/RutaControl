export interface PrecioLista { lista_id: string; producto_id: string; precio: number }
export interface ListaInfo { id: string; nombre: string; activo?: boolean | null; fecha_inicio?: string | null; fecha_fin?: string | null }
export interface RutaInfo { id: string; nombre?: string; lista_precio_id?: string | null }
export interface PrecioEspecial {
  id: string; cliente_id: string; producto_id: string; ruta_id: string | null; precio: number;
  fecha_inicio: string; fecha_fin: string | null; activo: boolean;
}

export type FuentePrecio = "especial_ruta" | "especial_general" | "lista_ruta" | "lista_cliente" | "general" | "sin_precio" | "conflicto";

export const ETIQUETA_FUENTE: Record<FuentePrecio, string> = {
  especial_ruta: "Precio especial para esta ruta",
  especial_general: "Precio especial del cliente",
  lista_ruta: "Lista de precios de la ruta",
  lista_cliente: "Lista del cliente",
  general: "Precio general",
  sin_precio: "Sin precio válido",
  conflicto: "Precios contradictorios",
};

export interface PrecioResuelto {
  precio: number;
  moneda: "CRC";
  fuente: FuentePrecio;
  valido: boolean;
  listaId?: string;
  listaNombre?: string;
  especialId?: string;
  vigencia?: { desde: string | null; hasta: string | null };
  mensaje: string;
}

/** Fecha comercial local (YYYY-MM-DD) del dispositivo. */
export function fechaComercial(d = new Date()): string {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

function vigente(desde: string | null | undefined, hasta: string | null | undefined, fecha: string) {
  return (!desde || desde <= fecha) && (!hasta || hasta >= fecha);
}

export function listaVigente(l: ListaInfo | undefined, fecha: string): boolean {
  return !!l && l.activo !== false && vigente(l.fecha_inicio, l.fecha_fin, fecha);
}

/**
 * Motor central de precios. Prioridad:
 * 1) especial del cliente para la ruta activa, 2) especial del cliente para todas las rutas,
 * 3) lista asignada a la ruta, 3b) lista del cliente (clasificación), 4) precio general (> 0).
 * Varios especiales vigentes con la misma prioridad son un conflicto y no se elige ninguno.
 */
export function resolverPrecio(args: {
  producto: { id: string; precio: number | null };
  clienteId?: string | null;
  rutaId?: string | null;
  fecha?: string;
  rutas?: RutaInfo[];
  listas?: ListaInfo[];
  precios?: PrecioLista[];
  especiales?: PrecioEspecial[];
  listaClienteId?: string | null;
}): PrecioResuelto {
  const { producto, clienteId, rutaId } = args;
  const fecha = args.fecha ?? fechaComercial();
  const especiales = (args.especiales ?? []).filter((e) => e.activo && e.cliente_id === clienteId && e.producto_id === producto.id && vigente(e.fecha_inicio, e.fecha_fin, fecha));
  const nivel = (lista: PrecioEspecial[], fuente: FuentePrecio): PrecioResuelto | null => {
    if (lista.length > 1) return { precio: 0, moneda: "CRC", fuente: "conflicto", valido: false, mensaje: `Hay ${lista.length} precios especiales vigentes contradictorios (${ETIQUETA_FUENTE[fuente]}). Corríjalos en la ficha del cliente.` };
    const e = lista[0];
    if (!e) return null;
    return { precio: Number(e.precio), moneda: "CRC", fuente, valido: true, especialId: e.id, vigencia: { desde: e.fecha_inicio, hasta: e.fecha_fin }, mensaje: ETIQUETA_FUENTE[fuente] };
  };
  if (clienteId) {
    const r1 = rutaId ? nivel(especiales.filter((e) => e.ruta_id === rutaId), "especial_ruta") : null;
    if (r1) return r1;
    const r2 = nivel(especiales.filter((e) => e.ruta_id === null), "especial_general");
    if (r2) return r2;
  }
  const deLista = (listaId: string | null | undefined, fuente: FuentePrecio): PrecioResuelto | null => {
    if (!listaId) return null;
    const lista = args.listas?.find((l) => l.id === listaId);
    if (args.listas && !listaVigente(lista, fecha)) return null;
    const p = args.precios?.find((x) => x.lista_id === listaId && x.producto_id === producto.id);
    if (!p) return null;
    return { precio: Number(p.precio), moneda: "CRC", fuente, valido: true, listaId, listaNombre: lista?.nombre, vigencia: { desde: lista?.fecha_inicio ?? null, hasta: lista?.fecha_fin ?? null }, mensaje: `${ETIQUETA_FUENTE[fuente]}${lista ? `: ${lista.nombre}` : ""}` };
  };
  const ruta = rutaId ? args.rutas?.find((r) => r.id === rutaId) : undefined;
  const r3 = deLista(ruta?.lista_precio_id, "lista_ruta") ?? deLista(args.listaClienteId, "lista_cliente");
  if (r3) return r3;
  const general = Number(producto.precio ?? 0);
  if (general > 0) return { precio: general, moneda: "CRC", fuente: "general", valido: true, mensaje: ETIQUETA_FUENTE.general };
  return { precio: 0, moneda: "CRC", fuente: "sin_precio", valido: false, mensaje: "Este producto no tiene un precio válido para este cliente y ruta" };
}

/** Compatibilidad: precio de una lista con respaldo al precio general. */
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

export interface LineaPrecioManual {
  precio: number;
  precioOriginal?: number;
  precioModificado?: boolean;
  motivoModificacion?: string;
}

/**
 * Cambio manual de precio de una línea de venta, exclusivo de administradores.
 * Exige motivo y un precio válido; conserva el precio original de la primera
 * modificación y nunca altera el catálogo, las listas ni los precios especiales.
 */
export function aplicarPrecioManual<T extends LineaPrecioManual>(
  linea: T,
  precioNuevo: number,
  motivo: string,
  esAdmin: boolean,
): T {
  if (!esAdmin) throw new Error("Solo un administrador puede modificar manualmente el precio");
  if (!motivo.trim()) throw new Error("Debe indicar el motivo de la modificación");
  if (!Number.isFinite(precioNuevo) || precioNuevo < 0 || Math.abs(precioNuevo * 100 - Math.round(precioNuevo * 100)) > 0.000001) {
    throw new Error("El precio debe ser positivo o cero y tener como máximo dos decimales");
  }
  return {
    ...linea,
    precio: precioNuevo,
    precioOriginal: linea.precioOriginal ?? linea.precio,
    precioModificado: true,
    motivoModificacion: motivo.trim(),
  };
}
