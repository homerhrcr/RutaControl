/** Reparte un abono entre deudas, de la más antigua a la más reciente, sin pasar el saldo de ninguna. */
export function distribuirAbono<T extends { id: string; saldo: number | string }>(creditos: T[], monto: number) {
  const partes: { credito: T; monto: number }[] = [];
  let restante = Math.max(0, monto);
  for (const c of creditos) {
    if (restante <= 0) break;
    const aplicar = Math.min(restante, Number(c.saldo));
    if (aplicar <= 0) continue;
    partes.push({ credito: c, monto: aplicar });
    restante -= aplicar;
  }
  return { partes, aplicado: Math.max(0, monto) - restante, sobrante: restante };
}
