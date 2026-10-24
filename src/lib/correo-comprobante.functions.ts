import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const esquema = z.object({
  venta_id: z.string().uuid(),
  correo: z.string().trim().email("Correo inválido").max(200),
  reenvio: z.boolean().optional(),
});

const crc = (n: number) => new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(n);

export type EnvioCorreoResultado = { enviado: boolean; motivo?: "bloqueado" | "error"; detalle?: string };

/** Envía el comprobante de una venta al correo del cliente. Lee la venta con los permisos del usuario. */
export const enviarComprobantePorCorreo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => esquema.parse(i))
  .handler(async ({ data, context }): Promise<EnvioCorreoResultado> => {
    const sb = context.supabase;
    const { data: v, error } = await sb.from("ventas").select("*, detalle_ventas(*), clientes(nombre)").eq("id", data.venta_id).maybeSingle();
    if (error || !v) return { enviado: false, motivo: "error", detalle: "Venta no encontrada" };
    const { data: fiscal } = await sb.from("config_fiscal").select("nombre_comercial,nombre_fiscal,telefono,correo").eq("organization_id", v.organization_id).maybeSingle();
    const { data: org } = await sb.from("organizations").select("nombre").eq("id", v.organization_id).maybeSingle();
    const empresa = fiscal?.nombre_comercial || fiscal?.nombre_fiscal || org?.nombre || "Su empresa";
    const pos = (v.pos_datos ?? {}) as { medio?: string; recibido?: number; vuelto?: number; receptor?: { nombre?: string; identificacion?: string } };
    const numero = v.id.replace(/-/g, "").slice(0, 8).toUpperCase();
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    try {
      const r = await sendTemplateEmail("comprobante-venta", data.correo, {
        idempotencyKey: `comprobante-venta-${v.id}${data.reenvio ? `-${Date.now()}` : ""}`,
        fromName: empresa,
        ...(fiscal?.correo ? { replyTo: fiscal.correo } : {}),
        templateData: {
          empresa, telefono: fiscal?.telefono || undefined, numero,
          cliente: pos.receptor?.nombre || (v as any).clientes?.nombre || undefined,
          identificacion: pos.receptor?.identificacion || undefined,
          fecha: new Date(v.fecha).toLocaleString("es-CR", { timeZone: "America/Costa_Rica" }),
          lineas: (v.detalle_ventas ?? []).map((d: any) => ({ nombre: d.nombre_producto, detalle: `${Number(d.cantidad)} x ${crc(Number(d.precio_unitario))}`, total: crc(Number(d.cantidad) * Number(d.precio_unitario)) })),
          descuento: Number(v.descuento) > 0 ? crc(Number(v.descuento)) : undefined,
          total: crc(Number(v.total)),
          pago: pos.medio ? pos.medio.toUpperCase() : v.metodo_pago === "credito" ? "Crédito" : "Contado",
          recibido: pos.medio === "efectivo" ? crc(Number(pos.recibido ?? 0)) : undefined,
          vuelto: pos.medio === "efectivo" ? crc(Number(pos.vuelto ?? 0)) : undefined,
        },
      });
      return r.sent ? { enviado: true } : { enviado: false, motivo: "bloqueado" };
    } catch (e) {
      console.error("[correo] comprobante", e instanceof Error ? e.message : e);
      return { enviado: false, motivo: "error", detalle: "No se pudo enviar el correo" };
    }
  });
