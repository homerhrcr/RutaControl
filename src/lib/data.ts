import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { notificarDocumentoTelegram } from "./telegram-notificar";

export function useProductos(soloActivos = false) {
  return useQuery({
    queryKey: ["productos", soloActivos],
    queryFn: async () => {
      let q = supabase.from("productos").select("*, categorias(nombre)").order("nombre");
      if (soloActivos) q = q.eq("activo", true);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useCategorias() {
  return useQuery({
    queryKey: ["categorias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categorias").select("*").order("nombre");
      if (error) throw error;
      return data;
    },
  });
}

export function useRutas() {
  return useQuery({
    queryKey: ["rutas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rutas").select("*").order("nombre");
      if (error) throw error;
      return data;
    },
  });
}

export function useClientes(rutaId?: string) {
  return useQuery({
    queryKey: ["clientes", rutaId ?? "all"],
    queryFn: async () => {
      const select = rutaId
        ? "*, cliente_rutas!inner(id, ruta_id, orden, rutas(nombre))"
        : "*, cliente_rutas(id, ruta_id, orden, rutas(nombre))";
      let q = supabase.from("clientes").select(select).order("nombre");
      if (rutaId) q = q.eq("cliente_rutas.ruta_id", rutaId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

// Guarda el orden de entrega de los clientes en una ruta
export async function guardarOrdenRuta(items: { id: string; orden: number }[]) {
  for (const it of items) {
    const { error } = await supabase
      .from("cliente_rutas")
      .update({ orden: it.orden })
      .eq("id", it.id);
    if (error) throw error;
  }
}

export function useCliente(id?: string) {
  return useQuery({
    queryKey: ["cliente", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreditosCliente(clienteId?: string) {
  return useQuery({
    queryKey: ["creditos-cliente", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creditos")
        .select("*")
        .eq("cliente_id", clienteId!)
        .gt("saldo", 0)
        .order("fecha");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreditosClienteDetalle(clienteId?: string) {
  return useQuery({
    queryKey: ["creditos-cliente-detalle", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creditos")
        .select("*, ventas(id, fecha, detalle_ventas(*))")
        .eq("cliente_id", clienteId!)
        .gt("saldo", 0)
        .order("fecha");
      if (error) throw error;
      return data;
    },
  });
}


export function useCreditosPendientes() {
  return useQuery({
    queryKey: ["creditos-pendientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creditos")
        .select("*, clientes(nombre, telefono, ruta_id)")
        .gt("saldo", 0)
        .order("fecha_limite");
      if (error) throw error;
      return data;
    },
  });
}

export function useVentasCliente(clienteId?: string, limit = 5) {
  return useQuery({
    queryKey: ["ventas-cliente", clienteId, limit],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ventas")
        .select("*, detalle_ventas(*)")
        .eq("cliente_id", clienteId!)
        .order("fecha", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });
}

export function useAbonosCliente(clienteId?: string, limit = 100) {
  return useQuery({
    queryKey: ["abonos-cliente", clienteId, limit],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("abonos")
        .select("*")
        .eq("cliente_id", clienteId!)
        .order("fecha", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
  });
}


export function useInvalidate() {
  const qc = useQueryClient();
  return (keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

export interface CartItem {
  producto_id: string;
  nombre: string;
  precio: number;
  cantidad: number;
}

export async function registrarVenta(params: {
  id?: string;
  carga_id?: string | null;
  cliente_id: string;
  ruta_id: string | null;
  vendedor_id: string;
  items: CartItem[];
  descuento: number;
  metodo: "contado" | "credito";
  fecha_limite?: string | null;
  lat?: number | null;
  lng?: number | null;
}) {
  if (params.carga_id) {
    const { data, error } = await supabase.rpc("vender_desde_camion", { p: { ...params, id: params.id ?? crypto.randomUUID() } as never });
    if (error) throw error;
    const venta = data as unknown as { id: string; fecha: string; total: number; carga_id: string };
    await notificarDocumentoTelegram("tiquete", venta.id);
    return venta;
  }
  const subtotal = params.items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const total = Math.max(0, subtotal - params.descuento);

  // Idempotencia reanudable: si la venta ya existe (p.ej. quedó a medias por un corte),
  // se completan solo los pasos que falten en lugar de darla por terminada.
  let venta: any = null;
  if (params.id) {
    const { data: existente, error: eErr } = await supabase.from("ventas").select("*").eq("id", params.id).maybeSingle();
    if (eErr) throw eErr;
    venta = existente;
  }

  if (!venta) {
    const { data: nueva, error: vErr } = await supabase
      .from("ventas")
      .insert({
        ...(params.id ? { id: params.id } : {}),
        cliente_id: params.cliente_id,
        ruta_id: params.ruta_id,
        vendedor_id: params.vendedor_id,
        subtotal,
        descuento: params.descuento,
        total,
        metodo_pago: params.metodo,
        latitud: params.lat ?? null,
        longitud: params.lng ?? null,
      })
      .select()
      .single();
    if (vErr) throw vErr;
    venta = nueva;
  }

  // Detalle: solo si aún no existe
  const { count: detCount, error: dcErr } = await supabase
    .from("detalle_ventas")
    .select("id", { count: "exact", head: true })
    .eq("venta_id", venta.id);
  if (dcErr) throw dcErr;
  if (!detCount) {
    const detalle = params.items.map((i) => ({
      venta_id: venta.id,
      producto_id: i.producto_id,
      nombre_producto: i.nombre,
      cantidad: i.cantidad,
      precio_unitario: i.precio,
      total_linea: i.precio * i.cantidad,
    }));
    const { error: dErr } = await supabase.from("detalle_ventas").insert(detalle);
    if (dErr) throw dErr;
  }

  // Una salida por producto suma todas sus líneas; el detalle conserva sus precios.
  const cantidades = new Map<string, number>();
  for (const item of params.items) {
    cantidades.set(item.producto_id, (cantidades.get(item.producto_id) ?? 0) + item.cantidad);
  }
  // Inventario: marcador por venta y producto para no descontar dos veces
  const motivo = `Venta ${venta.id}`;
  for (const [productoId, cantidad] of cantidades) {
    const { data: mov, error: mErr } = await supabase
      .from("movimientos_inventario")
      .select("id")
      .eq("producto_id", productoId)
      .eq("motivo", motivo)
      .maybeSingle();
    if (mErr) throw mErr;
    if (mov) continue;
    const { data: prod, error: pErr } = await supabase.from("productos").select("existencia").eq("id", productoId).single();
    if (pErr) throw pErr;
    const { error: uErr } = await supabase
      .from("productos")
      .update({ existencia: Math.max(0, Number(prod.existencia) - cantidad) })
      .eq("id", productoId);
    if (uErr) throw uErr;
    const { error: iErr } = await supabase.from("movimientos_inventario").insert({
      producto_id: productoId,
      tipo: "salida",
      cantidad,
      motivo,
      usuario_id: params.vendedor_id,
    });
    if (iErr) throw iErr;
  }

  if (params.metodo === "credito") {
    const { data: cred, error: cErr } = await supabase
      .from("creditos")
      .select("id")
      .eq("venta_id", venta.id)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!cred) {
      const { error: ciErr } = await supabase.from("creditos").insert({
        venta_id: venta.id,
        cliente_id: params.cliente_id,
        monto: total,
        saldo: total,
        fecha_limite: params.fecha_limite ?? null,
        estado: "al_dia",
      });
      if (ciErr) throw ciErr;
    }
  }

  await supabase.from("auditoria").insert({
    usuario_id: params.vendedor_id,
    accion: "registrar_venta",
    entidad: "ventas",
    detalle: { venta_id: venta.id, total, metodo: params.metodo },
  });

  await notificarDocumentoTelegram("tiquete", venta.id);
  return venta;
}

export async function registrarAbono(params: {
  id?: string;
  credito_id: string;
  cliente_id: string;
  monto: number;
  cobrador_id: string;
  saldoActual: number;
}) {
  // Idempotencia: no duplicar un abono ya sincronizado
  if (params.id) {
    const { data: existente } = await supabase.from("abonos").select("id").eq("id", params.id).maybeSingle();
    if (existente) return;
  }
  // Saldo real del servidor (el local puede estar desactualizado si se registró offline)
  const { data: credActual } = await supabase.from("creditos").select("saldo").eq("id", params.credito_id).maybeSingle();
  const saldoBase = credActual ? Number(credActual.saldo) : params.saldoActual;
  const { error: aErr } = await supabase.from("abonos").insert({
    ...(params.id ? { id: params.id } : {}),
    credito_id: params.credito_id,
    cliente_id: params.cliente_id,
    monto: params.monto,
    cobrador_id: params.cobrador_id,
  });
  if (aErr) throw aErr;

  const nuevoSaldo = Math.max(0, saldoBase - params.monto);
  await supabase
    .from("creditos")
    .update({ saldo: nuevoSaldo, estado: nuevoSaldo === 0 ? "cancelado" : "al_dia" })
    .eq("id", params.credito_id);

  await supabase.from("auditoria").insert({
    usuario_id: params.cobrador_id,
    accion: "registrar_abono",
    entidad: "abonos",
    detalle: { credito_id: params.credito_id, monto: params.monto },
  });
}

// Eliminar una venta: restaura inventario y borra en cascada (detalle, créditos, abonos)
export async function eliminarVenta(ventaId: string) {
  const { data: venta, error: ventaError } = await supabase.from("ventas").select("carga_id").eq("id", ventaId).maybeSingle();
  if (ventaError) throw ventaError;
  if (venta?.carga_id) {
    const { error } = await supabase.rpc("anular_venta_camion", { p_venta: ventaId });
    if (error) throw error;
    return;
  }
  const { data: detalle } = await supabase
    .from("detalle_ventas")
    .select("producto_id, cantidad")
    .eq("venta_id", ventaId);

  for (const d of detalle ?? []) {
    if (!d.producto_id) continue;
    const { data: prod } = await supabase
      .from("productos")
      .select("existencia")
      .eq("id", d.producto_id)
      .single();
    if (prod) {
      await supabase
        .from("productos")
        .update({ existencia: Number(prod.existencia) + Number(d.cantidad) })
        .eq("id", d.producto_id);
    }
    await supabase.from("movimientos_inventario").insert({
      producto_id: d.producto_id,
      tipo: "entrada",
      cantidad: Number(d.cantidad),
      motivo: "Anulación de venta",
    });
  }

  const { error } = await supabase.from("ventas").delete().eq("id", ventaId);
  if (error) throw error;
}

// Eliminar un abono: restaura el saldo del crédito asociado
export async function eliminarAbono(abonoId: string) {
  const { data: abono } = await supabase
    .from("abonos")
    .select("credito_id, monto")
    .eq("id", abonoId)
    .single();

  const { error } = await supabase.from("abonos").delete().eq("id", abonoId);
  if (error) throw error;

  if (abono?.credito_id) {
    const { data: cred } = await supabase
      .from("creditos")
      .select("saldo, monto")
      .eq("id", abono.credito_id)
      .single();
    if (cred) {
      const nuevoSaldo = Math.min(
        Number(cred.monto),
        Number(cred.saldo) + Number(abono.monto),
      );
      await supabase
        .from("creditos")
        .update({
          saldo: nuevoSaldo,
          estado: nuevoSaldo === 0 ? "cancelado" : "al_dia",
        })
        .eq("id", abono.credito_id);
    }
  }
}

// Eliminar un cliente y todos sus datos relacionados
export async function eliminarCliente(clienteId: string) {
  const { error } = await supabase.from("clientes").delete().eq("id", clienteId);
  if (error) throw error;
}

