/** Estado de cuenta del cliente: datos puros compartidos por WhatsApp, impresión y correo. */
export type EstadoCuentaMovimiento = {
  fecha: string;
  tipo: "compra" | "abono";
  metodo?: string;
  lineas: { texto: string; total: number }[];
  total: number;
};

export type EstadoCuenta = {
  compras: number;
  pagadoContado: number;
  abonos: number;
  pagado: number;
  saldo: number;
  movimientos: EstadoCuentaMovimiento[];
};

const enRango = (f: string, desde?: string, hasta?: string) => {
  const d = (f ?? "").slice(0, 10);
  return !(desde && d < desde) && !(hasta && d > hasta);
};

/**
 * Compras de contado cuentan como pagadas; el saldo pendiente es únicamente
 * el saldo vivo de los créditos (nunca compras − pagos).
 */
export function calcularEstadoCuenta(
  ventas: any[],
  abonos: any[],
  creditosPendientes: any[],
  desde?: string,
  hasta?: string,
): EstadoCuenta {
  const vs = (ventas ?? []).filter((v) => enRango(v.fecha, desde, hasta));
  const as = (abonos ?? []).filter((a) => enRango(a.fecha, desde, hasta));
  const compras = vs.reduce((s, v) => s + Number(v.total ?? 0), 0);
  const pagadoContado = vs.filter((v) => v.metodo_pago !== "credito").reduce((s, v) => s + Number(v.total ?? 0), 0);
  const totalAbonos = as.reduce((s, a) => s + Number(a.monto ?? 0), 0);
  const saldo = (creditosPendientes ?? []).reduce((s, c) => s + Number(c.saldo ?? 0), 0);
  const movimientos: EstadoCuentaMovimiento[] = [
    ...vs.map((v) => ({
      fecha: v.fecha,
      tipo: "compra" as const,
      metodo: v.metodo_pago === "credito" ? "Crédito" : "Contado",
      lineas: (v.detalle_ventas ?? []).map((d: any) => ({ texto: `${Number(d.cantidad)}× ${d.nombre_producto}`, total: Number(d.total_linea) })),
      total: Number(v.total ?? 0),
    })),
    ...as.map((a) => ({ fecha: a.fecha, tipo: "abono" as const, lineas: [], total: Number(a.monto ?? 0) })),
  ].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  return { compras, pagadoContado, abonos: totalAbonos, pagado: pagadoContado + totalAbonos, saldo, movimientos };
}

export const fechaCorta = (f?: string) =>
  f ? new Date(f).toLocaleDateString("es-CR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Costa_Rica" }) : "—";

export function textoWhatsApp(e: EstadoCuenta, empresa: string, cliente: string, fmt: (n: number) => string): string {
  const l: string[] = [
    "📋 *ESTADO DE CUENTA*",
    `🏢 *${empresa}*`,
    `👤 *Cliente:* ${cliente}`,
    `📅 *Fecha:* ${fechaCorta(new Date().toISOString())}`,
    "",
    "*RESUMEN:*",
    `• Compras: ${fmt(e.compras)}`,
    `• Pagado (contado + abonos): ${fmt(e.pagado)}`,
    `• *Saldo pendiente: ${fmt(e.saldo)}*`,
  ];
  if (e.movimientos.length) {
    l.push("", "*DETALLE DE MOVIMIENTOS:*");
    for (const m of e.movimientos) {
      if (m.tipo === "abono") {
        l.push(`💵 *${fechaCorta(m.fecha)}* · Abono: ${fmt(m.total)}`);
        continue;
      }
      l.push(`📦 *${fechaCorta(m.fecha)}* · ${m.metodo}`);
      for (const x of m.lineas) l.push(`  • ${x.texto}: ${fmt(x.total)}`);
      l.push(`  Total: ${fmt(m.total)}`);
    }
  }
  l.push("", "Gracias por su preferencia.");
  return l.join("\n");
}
