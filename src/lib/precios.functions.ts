import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Modificación manual del precio de una línea de una venta ya guardada.
 * Solo administradores de la empresa activa; queda registrado en auditoría
 * (precio original, precio final, usuario, fecha y motivo) y se recalculan
 * los totales de la venta y el saldo del crédito pendiente.
 * No toca el catálogo, las listas de precios ni los precios especiales.
 */
export const editarPrecioLineaVenta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        detalleId: z.string().uuid(),
        precioNuevo: z.number().min(0),
        motivo: z.string().trim().min(3, "Indique el motivo de la modificación").max(300),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Validación de permisos en el servidor: un vendedor es rechazado aunque
    // envíe la solicitud directamente al backend.
    const { data: isAdmin, error: rErr } = await supabase.rpc("is_admin", { _user_id: userId });
    if (rErr) throw new Error(rErr.message);
    if (!isAdmin) throw new Error("Solo un administrador puede modificar manualmente el precio");

    const { data: linea, error: lErr } = await supabase
      .from("detalle_ventas")
      .select("*")
      .eq("id", data.detalleId)
      .single();
    if (lErr || !linea) throw new Error("Línea de venta no encontrada");

    // El precio original se conserva de la primera modificación.
    const precioOriginal = linea.precio_modificado
      ? Number(linea.precio_original)
      : Number(linea.precio_unitario);
    const totalLinea = Number(linea.cantidad) * data.precioNuevo;

    const { error: uErr } = await supabase
      .from("detalle_ventas")
      .update({
        precio_unitario: data.precioNuevo,
        total_linea: totalLinea,
        precio_original: precioOriginal,
        precio_modificado: true,
        modificado_por: userId,
        modificado_en: new Date().toISOString(),
        motivo_modificacion: data.motivo,
      })
      .eq("id", data.detalleId);
    if (uErr) throw new Error(uErr.message);

    // Recalcular subtotal y total de la venta con las reglas existentes.
    const { data: lineas } = await supabase
      .from("detalle_ventas")
      .select("total_linea")
      .eq("venta_id", linea.venta_id);
    const subtotal = (lineas ?? []).reduce((s, l) => s + Number(l.total_linea), 0);
    const { data: venta } = await supabase
      .from("ventas")
      .select("descuento, total")
      .eq("id", linea.venta_id)
      .single();
    const total = Math.max(0, subtotal - Number(venta?.descuento ?? 0));
    await supabase.from("ventas").update({ subtotal, total }).eq("id", linea.venta_id);

    // Si la venta tiene un crédito pendiente, su saldo se ajusta por la diferencia.
    const { data: cred } = await supabase
      .from("creditos")
      .select("id, saldo")
      .eq("venta_id", linea.venta_id)
      .gt("saldo", 0)
      .maybeSingle();
    if (cred && venta) {
      const delta = total - Number(venta.total);
      const nuevoSaldo = Math.max(0, Number(cred.saldo) + delta);
      await supabase
        .from("creditos")
        .update({ saldo: nuevoSaldo, estado: nuevoSaldo === 0 ? "cancelado" : "al_dia" })
        .eq("id", cred.id);
    }

    await supabase.from("auditoria").insert({
      usuario_id: userId,
      accion: "modificar_precio_linea",
      entidad: "detalle_ventas",
      detalle: {
        detalle_id: data.detalleId,
        venta_id: linea.venta_id,
        producto: linea.nombre_producto,
        precio_original: precioOriginal,
        precio_final: data.precioNuevo,
        motivo: data.motivo,
      },
    });

    return { ok: true as const, subtotal, total };
  });
