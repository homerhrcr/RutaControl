import { formatCRC, formatDateTime } from "./format";

export type DevolucionTiquete = {
  id: string;
  fecha: string;
  cliente_id: string | null;
  tipo: string;
  total: number | string;
  aplicado_credito: number | string;
  clientes: { nombre: string } | null;
  rutas: { nombre: string } | null;
  devoluciones_detalle: {
    nombre_producto: string;
    cantidad: number | string;
    precio_unitario: number | string;
    motivo: string;
    destino: string;
  }[];
};

export function textoDevolucion(d: DevolucionTiquete, empresa: string) {
  return [
    empresa,
    `Tiquete de devolución #${d.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`,
    formatDateTime(d.fecha),
    `Cliente: ${d.clientes?.nombre ?? "Retorno de ruta (sin cliente)"}`,
    d.rutas?.nombre ? `Ruta: ${d.rutas.nombre}` : null,
    "--------------------------------",
    ...d.devoluciones_detalle.flatMap((i) => [
      `${Number(i.cantidad)} x ${i.nombre_producto}`,
      `${formatCRC(Number(i.precio_unitario))} c/u · ${formatCRC(Number(i.cantidad) * Number(i.precio_unitario))}`,
      `Motivo: ${i.motivo}`,
      `Destino: ${i.destino === "merma" ? "Merma" : "Reingreso"}`,
    ]),
    "--------------------------------",
    `TOTAL DEVUELTO: ${formatCRC(Number(d.total))}`,
    `Rebajado de deuda: ${formatCRC(Number(d.aplicado_credito))}`,
    "Comprobante de productos recibidos. No es una factura ni una nota de crédito electrónica.",
  ].filter((line) => line !== null).join("\n");
}