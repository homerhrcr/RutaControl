import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { allOps, useOfflineQueue, type VentaParams, type EntregaParams } from "@/lib/offline";
import { disponibleCamion, enCamion, reservasPedidos, sumarProductos } from "./carga-camion-calculos";

export function useCargasCamion() {
  const { organizacionActiva } = useAuth();
  return useQuery({
     queryKey: ["cargas_camion", organizacionActiva?.id], enabled: !!organizacionActiva,
     refetchInterval: 15000, refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase.from("cargas_camion").select("*, rutas(nombre), cargas_camion_detalle(*), ventas(id), pedidos!pedidos_carga_id_fkey(id, estado, venta_id, pedidos_detalle(producto_id, cantidad))").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
export type CargaCamion = NonNullable<ReturnType<typeof useCargasCamion>["data"]>[number];

export function usePendientesCamion() {
  const { count } = useOfflineQueue();
  const { user, organizacionActiva } = useAuth();
  return useQuery({
    queryKey: ["cargas_camion-pendientes", user?.id, organizacionActiva?.id, count],
    networkMode: "always",
    queryFn: async () => (await allOps()).filter((o) => o.status !== "SYNCED").flatMap((o) => {
      const venta = o.entity === "ventas" ? o.payload as VentaParams : o.entity === "entregas" ? (o.payload as EntregaParams).venta : null;
      return venta?.carga_id ? [venta] : [];
    }),
  });
}
/** Existencias del camión con ventas offline descontadas y reservas de pedidos pendientes.
 *  `pedidoEntrega` excluye la reserva del pedido que se está entregando. */
export function descontarPendientes(carga: CargaCamion, pendientes: VentaParams[], pedidoEntrega?: string) {
  const confirmadas = new Set(carga.ventas.map((v) => v.id));
  const unicas = new Map(pendientes.filter((v) => v.carga_id === carga.id && (!v.id || !confirmadas.has(v.id))).map((v) => [v.id, v]));
  const cantidades = sumarProductos([...unicas.values()].flatMap((v) => v.items));
   const excluir = new Set([...confirmadas, ...unicas.keys()].filter(Boolean) as string[]);
  if (pedidoEntrega) excluir.add(pedidoEntrega);
  const reservas = reservasPedidos((carga.pedidos ?? []) as never, excluir);
  return carga.cargas_camion_detalle.map((d) => ({ ...d, vendido: Number(d.vendido) + (cantidades.get(d.producto_id) ?? 0), reservado: reservas.get(d.producto_id) ?? 0 }));
}
export { disponibleCamion, enCamion };