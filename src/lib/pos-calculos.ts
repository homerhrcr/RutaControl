import type { CartItem } from "./data";
export type ReceptorPOS = { nombre: string; tipo_identificacion: string; identificacion: string; correo: string; telefono: string; provincia: string; canton: string; distrito: string; direccion: string };
export type DatosPOS = { caja_id: string; organization_id: string; documento: "interno" | "nombre" | "electronica"; medio: "efectivo" | "tarjeta" | "sinpe"; recibido: number; correo: string; receptor: ReceptorPOS };
export const receptorVacio: ReceptorPOS = { nombre: "", tipo_identificacion: "01", identificacion: "", correo: "", telefono: "", provincia: "", canton: "", distrito: "", direccion: "" };
export function totalPOS(items: CartItem[]) { return Math.round(items.reduce((s, i) => s + i.precio * i.cantidad, 0) * 100) / 100; }
export function vueltoPOS(total: number, recibido: number) {
  if (!Number.isFinite(recibido) || recibido < total) throw new Error("El efectivo recibido es insuficiente");
  return Math.round((recibido - total) * 100) / 100;
}
export function validarReceptorPOS(documento: DatosPOS["documento"], receptor: ReceptorPOS) {
  if (documento !== "interno" && !receptor.nombre.trim()) return "Indique el nombre del cliente";
  if (receptor.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receptor.correo)) return "Indique un correo válido";
  if (documento === "electronica") return "La conexión con Hacienda aún no está habilitada";
  return null;
}