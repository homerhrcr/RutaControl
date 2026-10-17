import { createHash, timingSafeEqual, randomBytes } from "node:crypto";
import { createHmac } from "node:crypto";
import { tokenInicio, telegramUpdateSchema, esComandoPedido, esComandoDevolucion, TEXTO_DEVOLUCION } from "./telegram";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const nuevoToken = () => randomBytes(24).toString("hex");
export function webhookSecret() {
  const key = process.env["TELEGRAM_API_KEY"];
  if (!key) throw new Error("Telegram no está conectado");
  return createHash("sha256").update(`telegram-webhook:${key}`).digest("base64url");
}
export function verificarWebhook(valor: string) {
  const expected = Buffer.from(webhookSecret());
  const actual = Buffer.from(valor);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export async function telegramApi(metodo: string, body: Record<string, unknown> = {}) {
  const key = process.env["LOVABLE_API_KEY"];
  const telegram = process.env["TELEGRAM_API_KEY"];
  if (!key || !telegram) throw new Error("Telegram no está conectado");
  const response = await fetch(`https://connector-gateway.lovable.dev/telegram/${metodo}`, {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "X-Connection-Api-Key": telegram, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error(`Telegram [${response.status}]: ${detail}`);
    throw new Error(`Telegram [${response.status}]: ${detail}`);
  }
  const result = await response.json() as { ok: boolean; result: any; description?: string; error_code?: number };
  if (!result.ok) {
    console.error(`Telegram [${result.error_code}]: ${result.description}`);
    throw new Error(`Telegram [${result.error_code}]: ${result.description ?? "Error del proveedor"}`);
  }
  return result.result;
}

export function firmaPedido(chatId: string | number) {
  return createHmac("sha256", webhookSecret()).update(`pedido:${chatId}`).digest("base64url");
}
export function verificarFirmaPedido(chatId: string, firma: string) {
  const a = Buffer.from(firmaPedido(chatId)); const b = Buffer.from(firma);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function ofrecerCatalogo(chatId: number, origin: string, texto = "Toca el botón para ver el catálogo y hacer tu pedido.") {
  const url = `${origin}/telegram/catalogo?c=${chatId}&s=${firmaPedido(chatId)}`;
  try { await telegramApi("setChatMenuButton", { chat_id: chatId, menu_button: { type: "web_app", text: "🛒 Hacer pedido", web_app: { url } } }); }
  catch (e) { console.error("Telegram menú", e); }
  try { await telegramApi("setMyCommands", { commands: [{ command: "pedido", description: "Hacer un pedido" }, { command: "devolucion", description: "Solicitar una devolución" }] }); }
  catch (e) { console.error("Telegram comandos", e); }
  await telegramApi("sendMessage", { chat_id: chatId, text: texto, reply_markup: { inline_keyboard: [[{ text: "🛒 Hacer pedido", web_app: { url } }]] } });
  await telegramApi("sendMessage", { chat_id: chatId, text: "¿Tiene productos para devolver? Toque «↩️ Devoluciones».", reply_markup: { keyboard: [[{ text: "↩️ Devoluciones" }]], resize_keyboard: true, is_persistent: true } });
}

export async function procesarUpdate(input: unknown, admin: any, origin = "") {
  const parsed = telegramUpdateSchema.safeParse(input);
  if (!parsed.success) return { ignored: true };
  const { update_id, message } = parsed.data;
  if (!message || message.chat.type !== "private") return { ignored: true };
  const texto = message.text ?? message.caption ?? (message.photo ? "[Foto recibida]" : message.document ? `[Documento: ${message.document.file_name ?? "adjunto"}]` : "[Mensaje sin texto]");
  const token = tokenInicio(texto);
  const { data, error } = await admin.rpc("telegram_recibir", {
    p_update_id: update_id, p_chat_id: message.chat.id,
    p_nombre: [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" "),
    p_texto: texto, p_token_hash: token ? hashToken(token) : null,
  });
  if (error) throw error;
  const respuestas: Record<string, string> = {
    vinculado: "Tu Telegram quedó vinculado a Ruta Directo. Recibirás confirmaciones y tiquetes aquí. Puedes escribirnos o enviar /stop para dejar de recibir notificaciones.",
    codigo_invalido: "El enlace venció o ya se utilizó. Solicita uno nuevo a tu vendedor.",
    chat_ocupado: "Este Telegram ya está vinculado a otro cliente. Solicita al vendedor revisar la vinculación.",
    cliente_ocupado: "El cliente ya tiene otro Telegram vinculado. Solicita al vendedor revisar la vinculación.",
    sin_vinculo: "Para vincularte solicita el enlace de Telegram a tu vendedor de Ruta Directo.",
    desvinculado: "Tu Telegram quedó desvinculado. No recibirás más notificaciones.",
  };
  if (origin && (data?.status === "vinculado" || (data?.status === "recibido" && esComandoPedido(texto)))) {
    try { await ofrecerCatalogo(message.chat.id, origin, data?.status === "vinculado" ? `${respuestas.vinculado}\n\nTambién puedes hacer pedidos desde el botón «🛒 Hacer pedido».` : undefined); return { ok: true }; }
    catch (e) { console.error("Telegram catálogo", e); }
  }
  if (data?.status === "recibido" && esComandoDevolucion(texto)) {
    respuestas.recibido = TEXTO_DEVOLUCION;
  } else if (data?.status === "recibido" && !texto.trim().startsWith("/")) {
    respuestas.recibido = "✅ Recibimos su mensaje. Nuestro equipo de ruta le responderá pronto. Para hacer un pedido escriba /pedido. Para devoluciones escriba /devolucion.";
  }
  const respuesta = respuestas[data?.status];
  if (respuesta) {
    try { await telegramApi("sendMessage", { chat_id: message.chat.id, text: respuesta }); }
    catch (e) { console.error("Telegram respuesta de vinculación", e); }
  }
  return { ok: true };
}

export async function enviarGuardado(admin: any, mensaje: any) {
  if (mensaje.estado === "enviado") return { status: "enviado" as const };
  if (mensaje.estado === "enviando" || mensaje.estado === "incierto") return { status: "incierto" as const };
  const { data: vinculo, error: vErr } = await admin.from("telegram_clientes").select("chat_id,activo").eq("organization_id", mensaje.organization_id).eq("cliente_id", mensaje.cliente_id).maybeSingle();
  if (vErr) throw vErr;
  if (!vinculo?.activo || !vinculo.chat_id) return { status: "sin_vinculo" as const };
  const { data: claimed, error: claimError } = await admin.from("telegram_mensajes").update({ estado: "enviando", error: null }).eq("id", mensaje.id).in("estado", ["pendiente", "error"]).select("id").maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return { status: "incierto" as const };
  try {
    const enviado = await telegramApi("sendMessage", { chat_id: vinculo.chat_id, text: mensaje.texto });
    const { error } = await admin.from("telegram_mensajes").update({ estado: "enviado", telegram_message_id: enviado.message_id, error: null }).eq("id", mensaje.id);
    if (error) throw error;
    return { status: "enviado" as const };
  } catch (e) {
    const detail = e instanceof Error ? e.message : "Error Telegram";
    const knownRejection = /Telegram \[(4\d\d|429)\]/.test(detail);
    await admin.from("telegram_mensajes").update({ estado: knownRejection ? "error" : "incierto", error: detail.slice(0, 1000) }).eq("id", mensaje.id);
    return { status: knownRejection ? "error" as const : "incierto" as const };
  }
}