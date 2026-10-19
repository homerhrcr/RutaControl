import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCliente, useClientes, useProductos } from "@/lib/data";
import { precioCliente } from "./precios";

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

export function useProductosCliente(clienteId?: string) {
  const productos = useProductos(true);
  const cliente = useCliente(clienteId);
  const clientes = useClientes();
  const listas = useListasPrecios();
  const precios = usePreciosProductos();
  const ficha = cliente.data ?? clientes.data?.find((c) => c.id === clienteId);
  const listaId = ficha?.lista_precio_id;
  const listo = !clienteId || (!!ficha && (!listaId || precios.data !== undefined));
  return {
    data: productos.data?.map((p) => ({ ...p, precio: precioCliente(p, listaId, precios.data ?? []) })),
    listo,
    listaNombre: listas.data?.find((l) => l.id === listaId)?.nombre ?? (listaId ? "Lista del cliente" : "Precio base"),
    error: productos.error ?? (clienteId && !ficha ? cliente.error : null) ?? (listaId ? precios.error : null),
  };
}