import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { pedidoTelegramSchema } from "@/lib/telegram";

const accesoSchema = z.object({ c: z.string().regex(/^-?\d{1,20}$/), s: z.string().regex(/^[A-Za-z0-9_-]{20,100}$/) });

async function resolverCliente(c: string, s: string) {
  const { verificarFirmaPedido } = await import("@/lib/telegram.server");
  if (!verificarFirmaPedido(c, s)) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: vinc } = await supabaseAdmin.from("telegram_clientes").select("organization_id,cliente_id,activo").eq("chat_id", Number(c)).eq("activo", true).maybeSingle();
  if (!vinc) return null;
  const { data: org } = await supabaseAdmin.from("organizations").select("nombre,estado").eq("id", vinc.organization_id).maybeSingle();
  if (!org || org.estado !== "active") return null;
  const { data: cliente } = await supabaseAdmin.from("clientes").select("id,nombre,ruta_id").eq("id", vinc.cliente_id).eq("organization_id", vinc.organization_id).maybeSingle();
  if (!cliente) return null;
  return { admin: supabaseAdmin, org: vinc.organization_id, empresa: org.nombre, cliente };
}

async function catalogo(admin: any, org: string) {
  const [{ data: productos }, { data: categorias }] = await Promise.all([
    admin.from("productos").select("id,nombre,precio,categoria_id,existencia").eq("organization_id", org).eq("activo", true).order("nombre"),
    admin.from("categorias").select("id,nombre").eq("organization_id", org).order("nombre"),
  ]);
  return { productos: productos ?? [], categorias: categorias ?? [] };
}

export const Route = createFileRoute("/api/public/telegram/catalogo")({
  server: { handlers: {
    GET: async ({ request }) => {
      const u = new URL(request.url);
      const p = accesoSchema.safeParse({ c: u.searchParams.get("c"), s: u.searchParams.get("s") });
      if (!p.success) return Response.json({ error: "Enlace inválido" }, { status: 400 });
      const r = await resolverCliente(p.data.c, p.data.s);
      if (!r) return Response.json({ error: "Tu Telegram no está vinculado. Solicita el enlace a tu vendedor." }, { status: 403 });
      const cat = await catalogo(r.admin, r.org);
      return Response.json({ empresa: r.empresa, cliente: r.cliente.nombre, ...cat, productos: cat.productos.map((x: any) => ({ id: x.id, nombre: x.nombre, precio: Number(x.precio), categoria_id: x.categoria_id, agotado: Number(x.existencia) <= 0 })) }, { headers: { "Cache-Control": "no-store" } });
    },
    POST: async ({ request }) => {
      let body: unknown;
      try { body = await request.json(); } catch { return Response.json({ error: "Datos inválidos" }, { status: 400 }); }
      const p = pedidoTelegramSchema.safeParse(body);
      if (!p.success) return Response.json({ error: "Pedido inválido" }, { status: 400 });
      const d = p.data;
      const manana = new Date(Date.now() - 6 * 3600000 + 86400000).toISOString().slice(0, 10);
      if (d.fecha_entrega < manana) return Response.json({ error: "La fecha de entrega debe ser a partir de mañana" }, { status: 400 });
      const r = await resolverCliente(d.c, d.s);
      if (!r) return Response.json({ error: "Tu Telegram no está vinculado." }, { status: 403 });
      const { admin, org, cliente } = r;
      const { data: existente } = await admin.from("pedidos").select("id,cliente_id").eq("id", d.id).maybeSingle();
      if (existente) return existente.cliente_id === cliente.id ? Response.json({ ok: true, id: d.id }) : Response.json({ error: "Pedido inválido" }, { status: 409 });
      const ids = [...new Set(d.items.map((i) => i.producto_id))];
      const { data: prods } = await admin.from("productos").select("id,nombre,precio").eq("organization_id", org).eq("activo", true).in("id", ids);
      const mapa = new Map((prods ?? []).map((x: any) => [x.id, x]));
      if (mapa.size !== ids.length) return Response.json({ error: "Algún producto ya no está disponible" }, { status: 400 });
      const detalle = d.items.map((i) => { const x: any = mapa.get(i.producto_id); return { organization_id: org, pedido_id: d.id, producto_id: x.id, nombre_producto: x.nombre, cantidad: i.cantidad, precio_unitario: Number(x.precio) }; });
      const total = detalle.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
      const { error: e1 } = await admin.from("pedidos").insert({ id: d.id, organization_id: org, cliente_id: cliente.id, ruta_id: cliente.ruta_id, fecha_entrega: d.fecha_entrega, estado: "confirmado", total, notas: ["Pedido por Telegram", d.notas?.trim()].filter(Boolean).join(" — ") });
      if (e1) { console.error("Pedido Telegram", e1); return Response.json({ error: "No se pudo guardar el pedido" }, { status: 500 }); }
      const { error: e2 } = await admin.from("pedidos_detalle").insert(detalle);
      if (e2) { console.error("Detalle Telegram", e2); await admin.from("pedidos").delete().eq("id", d.id); return Response.json({ error: "No se pudo guardar el pedido" }, { status: 500 }); }
      try {
        const { textoDocumento } = await import("@/lib/telegram");
        const { telegramApi } = await import("@/lib/telegram.server");
        const texto = textoDocumento({ empresa: r.empresa, tipo: "pedido", id: d.id, cliente: cliente.nombre, fecha: d.fecha_entrega, estado: "Recibido", total, items: detalle.map((i) => ({ nombre: i.nombre_producto, cantidad: i.cantidad, total: i.cantidad * i.precio_unitario })) });
        await admin.from("telegram_mensajes").insert({ organization_id: org, cliente_id: cliente.id, direccion: "salida", texto, estado: "enviado", dedupe_key: `pedido-telegram:${d.id}` });
        await telegramApi("sendMessage", { chat_id: Number(d.c), text: texto });
      } catch (e) { console.error("Confirmación Telegram", e); }
      return Response.json({ ok: true, id: d.id, total });
    },
  } },
});
