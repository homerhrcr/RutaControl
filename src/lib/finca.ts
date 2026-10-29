// Ganadera San Bosco: cálculos de semana (lunes a domingo) y balance.
export function semanaDe(fechaISO: string) {
  const [y, m, d] = fechaISO.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dia = (dt.getUTCDay() + 6) % 7; // 0 = lunes
  const ini = new Date(dt);
  ini.setUTCDate(dt.getUTCDate() - dia);
  const fin = new Date(ini);
  fin.setUTCDate(ini.getUTCDate() + 6);
  return { desde: ini.toISOString().slice(0, 10), hasta: fin.toISOString().slice(0, 10) };
}

export function moverSemana(desde: string, semanas: number) {
  const [y, m, d] = desde.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + semanas * 7));
  return semanaDe(dt.toISOString().slice(0, 10));
}

export function balanceFinca(
  gastos: { monto: number }[],
  produccion: { cantidad: number; precio_unitario: number }[],
) {
  const totalGastos = gastos.reduce((s, g) => s + Number(g.monto), 0);
  const totalProducido = produccion.reduce((s, p) => s + Number(p.cantidad) * Number(p.precio_unitario), 0);
  return { totalGastos, totalProducido, utilidad: totalProducido - totalGastos };
}
