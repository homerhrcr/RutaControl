import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
        ? "*, cliente_rutas!inner(ruta_id, rutas(nombre))"
        : "*, cliente_rutas(ruta_id, rutas(nombre))";
      let q = supabase.from("clientes").select(select).order("nombre");
      if (rutaId) q = q.eq("cliente_rutas.ruta_id", rutaId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
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
  const subtotal = params.items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const total = Math.max(0, subtotal - params.descuento);

  const { data: venta, error: vErr } = await supabase
    .from("ventas")
    .insert({
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

  // inventory movements + stock decrement
  for (const i of params.items) {
    await supabase.from("movimientos_inventario").insert({
      producto_id: i.producto_id,
      tipo: "salida",
      cantidad: i.cantidad,
      motivo: "Venta",
      usuario_id: params.vendedor_id,
    });
    const { data: prod } = await supabase.from("productos").select("existencia").eq("id", i.producto_id).single();
    if (prod) {
      await supabase.from("productos").update({ existencia: Number(prod.existencia) - i.cantidad }).eq("id", i.producto_id);
    }
  }

  if (params.metodo === "credito") {
    await supabase.from("creditos").insert({
      venta_id: venta.id,
      cliente_id: params.cliente_id,
      monto: total,
      saldo: total,
      fecha_limite: params.fecha_limite ?? null,
      estado: "al_dia",
    });
  }

  await supabase.from("auditoria").insert({
    usuario_id: params.vendedor_id,
    accion: "registrar_venta",
    entidad: "ventas",
    detalle: { venta_id: venta.id, total, metodo: params.metodo },
  });

  return venta;
}

export async function registrarAbono(params: {
  credito_id: string;
  cliente_id: string;
  monto: number;
  cobrador_id: string;
  saldoActual: number;
}) {
  const { error: aErr } = await supabase.from("abonos").insert({
    credito_id: params.credito_id,
    cliente_id: params.cliente_id,
    monto: params.monto,
    cobrador_id: params.cobrador_id,
  });
  if (aErr) throw aErr;

  const nuevoSaldo = Math.max(0, params.saldoActual - params.monto);
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
