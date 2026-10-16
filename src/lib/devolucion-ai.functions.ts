import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { analisisInputSchema } from "./devolucion-ai";

export const recomendarDevolucion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => analisisInputSchema.parse(input))
  .handler(async ({ context, data }) => {
    const [{ data: superadmin, error: sError }, { data: member, error: mError }, { data: org, error: oError }] = await Promise.all([
      context.supabase.rpc("is_platform_admin", { _uid: context.userId }),
      context.supabase.from("organization_members").select("role").eq("organization_id", data.organization_id).eq("user_id", context.userId).eq("estado", "active").maybeSingle(),
      context.supabase.rpc("current_organization_id"),
    ]);
    if (sError || mError || oError || org !== data.organization_id || (!superadmin && member?.role !== "administrador" && member?.role !== "vendedor")) {
      return { ok: false as const, status: 403, message: "Solo vendedores y administradores de la empresa pueden solicitar el análisis." };
    }
    const { data: producto, error } = await context.supabase.from("productos").select("nombre").eq("id", data.producto_id).eq("organization_id", data.organization_id).maybeSingle();
    if (error || !producto) return { ok: false as const, status: 404, message: "Producto no disponible en esta empresa." };
    // Estado de acceso del proveedor: persistente y compartido, no depende del navegador.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: denied, error: stateError } = await supabaseAdmin.from("auditoria").select("detalle").eq("accion", "ai_devolucion_provider_denied").order("fecha", { ascending: false }).limit(1);
    if (stateError) return { ok: false as const, status: 503, message: "No se pudo comprobar el acceso a Lovable AI." };
    if (denied?.length) return { ok: false as const, status: 403, message: "El proveedor de IA bloqueó el acceso. Un administrador debe restablecerlo antes de solicitar otro análisis." };
    const { analizarFotoDevolucion } = await import("./ai/devolucion.server");
    return analizarFotoDevolucion({
      nombre: producto.nombre,
      descripcion: data.descripcion,
      imagen: data.imagen,
      onDenied: async (message) => {
        const { error: logError } = await supabaseAdmin.from("auditoria").insert({
          organization_id: data.organization_id,
          usuario_id: context.userId,
          accion: "ai_devolucion_provider_denied",
          entidad: "devoluciones",
          detalle: { message },
        });
        if (logError) throw new Error("No se pudo guardar el bloqueo de acceso a IA.");
      },
    });
  });