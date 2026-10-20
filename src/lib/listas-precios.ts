import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCliente, useClientes, useProductos, useRutas } from "@/lib/data";
import { resolverPrecio, fechaComercial, type PrecioResuelto } from "./precios";

export function useListasPrecios() {
  const { organizacionActiva } = useAuth();
  return useQuery({
    queryKey: ["listas_precios", organizacionActiva?.id],
    enabled: !!organizacionActiva,
    queryFn: async () => {
      const { data, error } = await supabase.from("listas_precios").select("*").order("nombre");
      if (error) throw error;
      return data;
    },
  });
}

export function usePreciosProductos() {
  const { organizacionActiva } = useAuth();
  return useQuery({
    queryKey: ["precios_productos", organizacionActiva?.id],
    enabled: !!organizacionActiva,
    queryFn: async () => {
      const { data, error } = await supabase.from("precios_productos").select("*");
      if (error) throw error;
      return data;
    },
  });
}

/** Todos los precios especiales de la empresa (se guardan en caché para operar sin conexión). */
export function usePreciosEspeciales() {
  const { organizacionActiva } = useAuth();
  return useQuery({
    queryKey: ["precios_especiales", organizacionActiva?.id],
    enabled: !!organizacionActiva,
    queryFn: async () => {
      const { data, error } = await supabase.from("precios_especiales").select("*").order("fecha_inicio", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Productos con el precio que determina el motor central para el cliente y la ruta activa. */
export function useProductosCliente(clienteId?: string, rutaId?: string | null) {
  const productos = useProductos(true);
  const cliente = useCliente(clienteId);
  const clientes = useClientes();
  const listas = useListasPrecios();
  const precios = usePreciosProductos();
  const especiales = usePreciosEspeciales();
  const rutas = useRutas();
  const ficha = cliente.data ?? clientes.data?.find((c) => c.id === clienteId);
  const ruta = rutaId === undefined ? ficha?.ruta_id ?? null : rutaId;
  const fecha = fechaComercial();
  const listo = !clienteId || (!!ficha && precios.data !== undefined && listas.data !== undefined && especiales.data !== undefined && rutas.data !== undefined);
  const rutaInfo = rutas.data?.find((r) => r.id === ruta);
  const listaRuta = listas.data?.find((l) => l.id === rutaInfo?.lista_precio_id);
  return {
    data: productos.data?.map((p) => {
      const r: PrecioResuelto = resolverPrecio({
        producto: p, clienteId, rutaId: ruta, fecha, rutas: rutas.data ?? [], listas: listas.data ?? [],
        precios: precios.data ?? [], especiales: (especiales.data ?? []) as never, listaClienteId: ficha?.lista_precio_id,
      });
      return { ...p, precio: r.valido ? r.precio : 0, precioInfo: r };
    }),
    listo,
    rutaId: ruta,
    listaNombre: listaRuta ? `Lista de la ruta: ${listaRuta.nombre}` : rutaInfo ? `Ruta ${rutaInfo.nombre} sin lista asignada` : "Precio general",
    error: productos.error ?? (clienteId && !ficha ? cliente.error : null) ?? precios.error ?? especiales.error,
  };
}
