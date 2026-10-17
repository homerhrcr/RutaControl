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
/** Formats a yyyy-mm-dd delivery date as a readable Spanish date; other strings pass through. */
export function fechaLegible(fecha: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return fecha;
  const t = new Date(`${fecha}T12:00:00Z`).toLocaleDateString("es-CR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
export function textoDocumento(documento: { empresa: string; tipo: "pedido" | "tiquete"; id: string; cliente: string; fecha: string; ruta?: string; estado?: string; metodo?: string; total: number; descuento?: number; items: { nombre: string; cantidad: number; total: number }[] }) {
  const crc = (monto: number) => new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(monto);
  const numero = documento.id.replace(/-/g, "").slice(0, 8).toUpperCase();
  if (documento.tipo === "pedido") {
    const enRuta = documento.estado !== "Recibido";
    return [`🚚 ¡Hola ${documento.cliente}!`,
      enRuta ? `Le confirmamos que hemos recibido su pedido #${numero} en ${documento.empresa} y se encuentra programado para entrega.`
        : `Hemos recibido su pedido #${numero} en ${documento.empresa}. Le avisaremos cuando esté en ruta para ser entregado.`,
      "", ...(documento.ruta ? [`🛣️ Ruta de entrega: ${documento.ruta}`] : []), `📅 Fecha estimada de entrega: ${fechaLegible(documento.fecha)}`, "", "📦 Productos confirmados:",
      ...documento.items.map((i) => `• ${i.cantidad} × ${i.nombre.trim()}: ${crc(i.total)}`),
      "──────────────", `💰 TOTAL: ${crc(documento.total)}`, "",
      "¡Muchas gracias por su preferencia! Cualquier consulta nos puede responder por este chat.",
    ].join("\n");
  }
  return [documento.empresa, `Tiquete de caja #${numero}`,
    `Cliente: ${documento.cliente}`, `Fecha: ${documento.fecha}`,
    documento.estado ? `Estado: ${documento.estado}` : null, "──────────────",
    ...documento.items.map((i) => `${i.cantidad} × ${i.nombre}: ${crc(i.total)}`),
    documento.descuento ? `Descuento: ${crc(documento.descuento)}` : null,
    `TOTAL: ${crc(documento.total)}`, documento.metodo ? `Pago: ${documento.metodo === "credito" ? "Crédito" : "Contado"}` : null,
    "¡Gracias por su compra!",
  ].filter(Boolean).join("\n");
}
export function esComandoPedido(texto: string) {
  return /^\/(pedido|catalogo|menu)(@\w+)?$/i.test(texto.trim()) || /^hacer pedido$/i.test(texto.trim());
}
export function esComandoDevolucion(texto: string) {
  return /^\/(devolucion|devoluciones)(@\w+)?$/i.test(texto.trim()) || /^(↩️\s*)?devoluci[oó]n(es)?$/i.test(texto.trim());
}
export const TEXTO_DEVOLUCION = [
  "↩️ Solicitud de devolución recibida.",
  "",
  "⚠️ Importante: los productos a devolver deben estar COMPLETOS y en su EMPAQUE ORIGINAL para poder recibirlos.",
  "",
  "Escríbanos aquí qué productos y cantidades desea devolver y el motivo. Nuestro vendedor los recogerá en su próxima visita de ruta.",
].join("\n");
export const pedidoTelegramSchema = z.object({
  c: z.string().regex(/^-?\d{1,20}$/), s: z.string().regex(/^[A-Za-z0-9_-]{20,100}$/),
  id: z.string().uuid(),
  fecha_entrega: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notas: z.string().max(500).optional(),
  items: z.array(z.object({ producto_id: z.string().uuid(), cantidad: z.number().int().positive().max(9999) })).min(1).max(100),
});

export const MOTIVOS_DEVOLUCION = ["Vencimiento", "Empaque dañado", "Mal estado", "Producto no solicitado", "Otro"] as const;
export const devolucionTelegramSchema = z.object({
  modo: z.literal("devolucion"),
  c: z.string().regex(/^-?\d{1,20}$/), s: z.string().regex(/^[A-Za-z0-9_-]{20,100}$/),
  id: z.string().uuid(),
  notas: z.string().max(500).optional(),
  items: z.array(z.object({ producto_id: z.string().uuid(), cantidad: z.number().int().positive().max(9999), motivo: z.enum(MOTIVOS_DEVOLUCION) })).min(1).max(100),
});

export function textoSolicitudDevolucion(items: { nombre: string; cantidad: number; motivo: string }[], notas?: string) {
  const lineas = ["↩️ Solicitud de devolución registrada:", ...items.map((i) => `• ${i.cantidad} × ${i.nombre} (${i.motivo})`)];
  if (notas?.trim()) lineas.push(`📝 ${notas.trim()}`);
  lineas.push("", "Recuerde: los productos deben estar completos y en su empaque original. Nuestro vendedor los revisará en la próxima visita de ruta.");
  return lineas.join("\n");
}
