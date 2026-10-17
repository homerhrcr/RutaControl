import { z } from "zod";

export const telegramUpdateSchema = z.object({
  update_id: z.number().int().nonnegative(),
  message: z.object({
    message_id: z.number().int(),
    chat: z.object({ id: z.number().int(), type: z.string() }),
    from: z.object({ first_name: z.string(), last_name: z.string().optional() }).optional(),
    text: z.string().max(4096).optional(),
    caption: z.string().max(4096).optional(),
    photo: z.array(z.object({ file_id: z.string() })).optional(),
    document: z.object({ file_id: z.string(), file_name: z.string().optional() }).optional(),
  }).optional(),
});
export function tokenInicio(texto: string) {
  const match = /^\/start(?:@\w+)?\s+([a-f0-9]{48})$/.exec(texto.trim());
  return match?.[1] ?? null;
}
export function webhookPermitido(actual: string, destino: string) {
  return actual === "" || actual === destino;
}
export function textoDocumento(documento: { empresa: string; tipo: "pedido" | "tiquete"; id: string; cliente: string; fecha: string; estado?: string; metodo?: string; total: number; descuento?: number; items: { nombre: string; cantidad: number; total: number }[] }) {
  const crc = (monto: number) => new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(monto);
  return [documento.empresa, `${documento.tipo === "pedido" ? "Confirmación de pedido" : "Tiquete de caja"} #${documento.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`,
    `Cliente: ${documento.cliente}`, `Fecha${documento.tipo === "pedido" ? " de entrega" : ""}: ${documento.fecha}`,
    documento.estado ? `Estado: ${documento.estado}` : null, "──────────────",
    ...documento.items.map((i) => `${i.cantidad} × ${i.nombre}: ${crc(i.total)}`),
    documento.descuento ? `Descuento: ${crc(documento.descuento)}` : null,
    `TOTAL: ${crc(documento.total)}`, documento.metodo ? `Pago: ${documento.metodo === "credito" ? "Crédito" : "Contado"}` : null,
    "¡Gracias por su compra!",
  ].filter(Boolean).join("\n");
}