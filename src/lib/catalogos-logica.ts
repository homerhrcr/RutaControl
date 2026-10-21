/** Lógica pura de catálogos administrables (sin dependencias de navegador). */
export type OpcionBase = { id: string; etiqueta: string; codigo: string; activo: boolean; orden: number; predeterminado?: boolean };

const norm = (s: string) => s.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");

export function ordenar<T extends { orden: number; etiqueta: string }>(xs: T[]): T[] {
  return [...xs].sort((a, b) => a.orden - b.orden || a.etiqueta.localeCompare(b.etiqueta, "es"));
}

/** Opciones a ofrecer: solo activas, más el valor ya guardado aunque esté inactivo o ya no exista. */
export function opcionesSelector<T extends OpcionBase>(xs: T[], valorActual?: string | null) {
  const activas = ordenar(xs.filter((o) => o.activo)).map((o) => ({ value: o.codigo, label: o.etiqueta, inactiva: false }));
  if (valorActual && !activas.some((o) => o.value === valorActual)) {
    const previa = xs.find((o) => o.codigo === valorActual);
    activas.push({ value: valorActual, label: `${previa?.etiqueta ?? valorActual} (inactiva)`, inactiva: true });
  }
  return activas;
}

export function predeterminada<T extends OpcionBase>(xs: T[]): string | undefined {
  const act = ordenar(xs.filter((o) => o.activo));
  return (act.find((o) => o.predeterminado) ?? act[0])?.codigo;
}

export function etiquetaDe<T extends OpcionBase>(xs: T[], codigo: string | null | undefined) {
  return xs.find((o) => o.codigo === codigo)?.etiqueta ?? codigo ?? "";
}

/** Valida una etiqueta nueva o renombrada: no vacía, máx. 80 y sin duplicados (ignora mayúsculas y tildes). */
export function validarEtiqueta(xs: { id: string; etiqueta: string }[], etiqueta: string, idPropio?: string): string | null {
  const t = etiqueta.trim();
  if (!t) return "Escriba un nombre";
  if (t.length > 80) return "Máximo 80 caracteres";
  if (xs.some((o) => o.id !== idPropio && norm(o.etiqueta) === norm(t))) return "Ya existe una opción con ese nombre";
  return null;
}

/** Intercambia la posición de un elemento y devuelve los nuevos órdenes 1..n. */
export function mover<T extends { id: string; orden: number; etiqueta: string }>(xs: T[], id: string, delta: -1 | 1) {
  const lista = ordenar(xs);
  const i = lista.findIndex((x) => x.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= lista.length) return lista.map((x, k) => ({ id: x.id, orden: k + 1 }));
  [lista[i], lista[j]] = [lista[j], lista[i]];
  return lista.map((x, k) => ({ id: x.id, orden: k + 1 }));
}
