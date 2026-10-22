type ReferenciaCredito = {
  cliente_id?: string | null;
  ruta_id?: string | null;
  ventas?: { ruta_id?: string | null } | null;
};

/** Atribuye el cobro al crédito/venta de origen, no a otra ruta actual del cliente. */
export function atribuirCobranza(
  credito: ReferenciaCredito | null | undefined,
  clienteId: string | null,
  rutas: Map<string, string>,
  rutasClientes: Map<string, string[]>,
) {
  const id = credito?.ruta_id ?? credito?.ventas?.ruta_id;
  if (id) return { ruta: rutas.get(id) ?? "Sin ruta", rutas: [rutas.get(id) ?? "Sin ruta"] };
  const alternativas = rutasClientes.get(credito?.cliente_id ?? clienteId ?? "") ?? [];
  return { ruta: alternativas[0] ?? "Sin ruta", rutas: alternativas };
}

export function incluirCobranza(rutaSeleccionada: string, atribucion: ReturnType<typeof atribuirCobranza>) {
  return rutaSeleccionada === "all" || atribucion.rutas.includes(rutaSeleccionada);
}