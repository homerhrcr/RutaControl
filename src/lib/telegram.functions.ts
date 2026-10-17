import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { textoDocumento, webhookPermitido } from "./telegram";

async function empresa(context: { supabase: any; userId: string }) {
  const [{ data: staff, error }, { data: org }] = await Promise.all([
    context.supabase.rpc("is_staff", { _user_id: context.userId }), context.supabase.rpc("current_organization_id"),
  ]);
  if (error || !staff || !org) throw new Error("No autorizado");
  return String(org);
}
async function comprobarCliente(context: { supabase: any }, org: string, id: string) {
  const { data, error } = await context.supabase.from("clientes").select("id,nombre").eq("organization_id", org).eq("id", id).single();
  if (error || !data) throw new Error("Cliente no disponible en esta empresa");
  return data;
}
export const crearVinculoTelegram = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ clienteId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const org = await empresa(context);
    await comprobarCliente(context, org, data.clienteId);
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { telegramApi, nuevoToken, hashToken } = await import("./telegram.server");
    const bot = await telegramApi("getMe");
    const token = nuevoToken();
    const { error: expireError } = await admin.from("telegram_codigos").update({ consumed_at: new Date().toISOString() }).eq("organization_id", org).eq("cliente_id", data.clienteId).is("consumed_at", null);
    if (expireError) throw expireError;
    const { error } = await admin.from("telegram_codigos").insert({ organization_id: org, cliente_id: data.clienteId, token_hash: hashToken(token), expires_at: new Date(Date.now() + 86400000).toISOString(), created_by: context.userId });
    if (error) throw error;
    return { url: `https://t.me/${bot.username}?start=${token}` };
  });
export const desvincularTelegram = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ clienteId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const org = await empresa(context); await comprobarCliente(context, org, data.clienteId);
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { error } = await admin.from("telegram_clientes").update({ activo: false, chat_id: null }).eq("organization_id", org).eq("cliente_id", data.clienteId);
    if (error) throw error;
    const { error: cErr } = await admin.from("telegram_codigos").update({ consumed_at: new Date().toISOString() }).eq("organization_id", org).eq("cliente_id", data.clienteId).is("consumed_at", null);
    if (cErr) throw cErr;
    return { ok: true };
  });
export const enviarTelegram = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ clienteId: z.string().uuid().optional(), tipo: z.enum(["pedido", "tiquete", "mensaje"]), documentoId: z.string().uuid().optional(), texto: z.string().trim().min(1).max(4096).optional(), envioId: z.string().uuid().optional() }).parse(data))
  .handler(async ({ data, context }) => {
    const org = await empresa(context);
    let clienteId = data.clienteId;
    let texto = data.texto ?? "";
    let dedupe = `mensaje:${org}:${data.envioId ?? crypto.randomUUID()}`;
    if (data.tipo !== "mensaje") {
      if (!data.documentoId) throw new Error("Documento requerido");
      const result = data.tipo === "pedido"
        ? await context.supabase.from("pedidos").select("*,pedidos_detalle(*)").eq("id", data.documentoId).eq("organization_id", org).single()
        : await context.supabase.from("ventas").select("*,detalle_ventas(*)").eq("id", data.documentoId).eq("organization_id", org).single();
      const doc = result.data;
      const error = result.error;
      if (error || !doc?.cliente_id) throw new Error("Documento no disponible");
      if ("estado" in doc && !["confirmado", "cargado", "entregado"].includes(doc.estado)) throw new Error("Confirme el pedido antes de notificar");
      clienteId = doc.cliente_id;
      const cliente = await comprobarCliente(context, org, doc.cliente_id);
      const { data: organizacion } = await context.supabase.from("organizations").select("nombre").eq("id", org).single();
      const items = "pedidos_detalle" in doc ? doc.pedidos_detalle : doc.detalle_ventas;
      if (!items?.length) throw new Error("El documento todavía no tiene productos");
      texto = textoDocumento({ empresa: organizacion?.nombre ?? "Ruta Directo", tipo: data.tipo, id: doc.id, cliente: cliente.nombre,
        fecha: "fecha_entrega" in doc ? doc.fecha_entrega : new Date(doc.fecha).toLocaleString("es-CR", { timeZone: "America/Costa_Rica" }),
        estado: data.tipo === "pedido" ? "Confirmado" : undefined, metodo: "metodo_pago" in doc ? doc.metodo_pago : undefined, total: Number(doc.total), descuento: "descuento" in doc ? Number(doc.descuento) : 0,
        items: items.map((i: any) => ({ nombre: i.nombre_producto, cantidad: Number(i.cantidad), total: Number(i.cantidad) * Number(i.precio_unitario) })),
      });
      dedupe = `${data.tipo}:${org}:${doc.id}`;
    }
    if (!clienteId || !texto || texto.length > 4096) throw new Error("Seleccione cliente y un mensaje de hasta 4096 caracteres");
    await comprobarCliente(context, org, clienteId);
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { data: link, error: lErr } = await context.supabase.from("telegram_clientes").select("activo").eq("organization_id", org).eq("cliente_id", clienteId).maybeSingle();
    if (lErr) throw lErr;
    if (!link?.activo) return { status: "sin_vinculo" as const };
    const { error: insertError } = await admin.from("telegram_mensajes").upsert({ organization_id: org, cliente_id: clienteId, direccion: "salida", texto, dedupe_key: dedupe }, { onConflict: "dedupe_key", ignoreDuplicates: true });
    if (insertError) throw insertError;
    const { data: mensaje, error: mErr } = await admin.from("telegram_mensajes").select("*").eq("organization_id", org).eq("dedupe_key", dedupe).single();
    if (mErr) throw mErr;
    const { enviarGuardado } = await import("./telegram.server");
    return enviarGuardado(admin, mensaje);
  });

export const configurarWebhookTelegram = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: permitido, error } = await context.supabase.rpc("is_platform_admin", { _uid: context.userId });
    if (error || !permitido) throw new Error("Solo el Superadmin puede configurar el bot");
    const { telegramApi, webhookSecret } = await import("./telegram.server");
    const url = "https://rutadirecto.ingsoftcr.com/api/public/telegram/webhook";
    const info = await telegramApi("getWebhookInfo");
    if (!webhookPermitido(info.url, url)) throw new Error("Este bot está vinculado a otra aplicación; usa un bot exclusivo para Ruta Directo");
    const receptor = await fetch(url);
    if (!receptor.ok) throw new Error("La recepción de Telegram aún no está disponible públicamente. Publica los cambios antes de activarla");
    const estado = await receptor.json() as { service?: string; ok?: boolean };
    if (estado.service !== "Ruta Directo Telegram" || !estado.ok) throw new Error("La recepción de Telegram aún no está disponible públicamente");
    await telegramApi("setWebhook", { url, secret_token: webhookSecret(), allowed_updates: ["message"], drop_pending_updates: false });
    const resultado = await telegramApi("getWebhookInfo");
    return { activo: resultado.url === url };
  });