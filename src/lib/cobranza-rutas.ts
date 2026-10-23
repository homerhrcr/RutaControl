type CreditoRuta = {
  id: string;
  ruta_id?: string | null;
  ventas?: { ruta_id?: string | null } | null;
  clientes?: { ruta_id?: string | null; cliente_rutas?: { ruta_id: string }[] } | null;
};

/** Cada deuda pertenece a una sola ruta; el legado ambiguo se deja sin asignar. */
export function rutaDeCredito(credito: CreditoRuta): string {
  const origen = credito.ruta_id ?? credito.ventas?.ruta_id;
  if (origen) return origen;
  if (credito.clientes?.ruta_id) return credito.clientes.ruta_id;
  const rutas = [...new Set((credito.clientes?.cliente_rutas ?? []).map((r) => r.ruta_id))];
  return rutas.length === 1 ? rutas[0] : "sin-ruta";
}

export function creditosDeRuta<T extends CreditoRuta>(creditos: T[], rutaId: string): T[] {
  return creditos.filter((c) => rutaDeCredito(c) === rutaId);
}

export function limitarCreditos<T extends { id: string }>(creditos: T[], ids?: string[]): T[] {
  if (!ids) return creditos;
  const permitidos = new Set(ids);
  return creditos.filter((c) => permitidos.has(c.id));
}