/** Desglose de un pago en varias formas (Efectivo, SINPE, Transferencia…). */
export type PartePago = { medio: string; monto: string; referencia: string };

const crc = (n: number) => "₡" + Math.round(n).toLocaleString("es-CR");

export function sumaPartes(partes: PartePago[]) {
  return Math.round(partes.reduce((s, p) => s + (Number(p.monto) || 0), 0) * 100) / 100;
}

/** Texto legible que se guarda como forma de pago y referencia. */
export function resumenPartes(partes: PartePago[]) {
  const validas = partes.filter((p) => Number(p.monto) > 0);
  if (validas.length <= 1) {
    const p = validas[0] ?? partes[0];
    return { medio: p?.medio ?? "", referencia: p?.referencia.trim() ?? "" };
  }
  return {
    medio: "Mixto: " + validas.map((p) => `${p.medio} ${crc(Number(p.monto))}`).join(" + "),
    referencia: validas.filter((p) => p.referencia.trim()).map((p) => `${p.medio}: ${p.referencia.trim()}`).join("; "),
  };
}

/** Mensaje de error si el desglose no cuadra con el total, o null si está bien. */
export function errorPartes(partes: PartePago[] | undefined, total: number) {
  if (!partes || partes.length < 2) return null;
  if (partes.some((p) => !(Number(p.monto) > 0))) return "Indica el monto de cada forma de pago";
  const dif = Math.round((total - sumaPartes(partes)) * 100) / 100;
  if (dif > 0) return `Faltan ${crc(dif)} en las formas de pago`;
  if (dif < 0) return `Las formas de pago suman ${crc(-dif)} de más`;
  return null;
}
