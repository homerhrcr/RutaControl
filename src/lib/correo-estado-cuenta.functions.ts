import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calcularEstadoCuenta, fechaCorta } from "@/lib/estado-cuenta";

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(""));
const esquema = z.object({
  cliente_id: z.string().uuid(),
  correo: z.string().trim().email("Correo inválido").max(200),
  desde: fecha,
  hasta: fecha,
});

const crc = (n: number) => new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(n);

/** Envía el estado de cuenta del cliente; los montos se calculan en el servidor con los permisos del usuario. */
export const enviarEstadoCuentaPorCorreo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => esquema.parse(i))
  .handler(async ({ data, context }): Promise<{ enviado: boolean; motivo?: "bloqueado" | "error" }> => {
    const sb = context.supabase;
    const { data: cli } = await sb.from("clientes").select("id,nombre,organization_id").eq("id", data.cliente_id).maybeSingle();
    if (!cli) return { enviado: false, motivo: "error" };
    const [{ data: ventas }, { data: abonos }, { data: creditos }, { data: fiscal }, { data: org }] = await Promise.all([
      sb.from("ventas").select("*, detalle_ventas(*)").eq("cliente_id", cli.id).order("fecha", { ascending: false }).limit(100),
      sb.from("abonos").select("*").eq("cliente_id", cli.id).order("fecha", { ascending: false }).limit(100),
      sb.from("creditos").select("saldo").eq("cliente_id", cli.id).gt("saldo", 0),
      sb.from("config_fiscal").select("nombre_comercial,nombre_fiscal,telefono,correo").eq("organization_id", cli.organization_id).maybeSingle(),
      sb.from("organizations").select("nombre").eq("id", cli.organization_id).maybeSingle(),
    ]);
    const e = calcularEstadoCuenta(ventas ?? [], abonos ?? [], creditos ?? [], data.desde || undefined, data.hasta || undefined);
    const empresa = fiscal?.nombre_comercial || fiscal?.nombre_fiscal || org?.nombre || "Su empresa";
    const periodo = data.desde || data.hasta ? `${data.desde ? fechaCorta(data.desde + "T12:00:00") : "inicio"} – ${data.hasta ? fechaCorta(data.hasta + "T12:00:00") : "hoy"}` : undefined;
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    try {
      const r = await sendTemplateEmail("estado-cuenta", data.correo, {
        idempotencyKey: `estado-cuenta-${cli.id}-${Date.now()}`,
        fromName: empresa,
        ...(fiscal?.correo ? { replyTo: fiscal.correo } : {}),
        templateData: {
          empresa, telefono: fiscal?.telefono || undefined, cliente: cli.nombre,
          fecha: fechaCorta(new Date().toISOString()), periodo,
          compras: crc(e.compras), pagado: crc(e.pagado), saldo: crc(e.saldo),
          movimientos: e.movimientos.map((m) => ({
            titulo: `${fechaCorta(m.fecha)} · ${m.tipo === "abono" ? "Abono" : m.metodo}`,
            lineas: m.lineas.map((x) => `${x.texto}: ${crc(x.total)}`),
            total: crc(m.total),
          })),
        },
      });
      return r.sent ? { enviado: true } : { enviado: false, motivo: "bloqueado" };
    } catch (err) {
      console.error("[correo] estado de cuenta", err instanceof Error ? err.message : err);
      return { enviado: false, motivo: "error" };
    }
  });
