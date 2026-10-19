import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { allOps, useOfflineQueue, type VentaParams, type EntregaParams } from "@/lib/offline";
import { disponibleCamion, sumarProductos } from "./carga-camion-calculos";

export function useCargasCamion() {
  const { organizacionActiva } = useAuth();
  return useQuery({
    queryKey: ["cargas_camion", organizacionActiva?.id], enabled: !!organizacionActiva,
    queryFn: async () => {
      const { data, error } = await supabase.from("cargas_camion").select("*, rutas(nombre), cargas_camion_detalle(*), ventas(id)").order("created_at", { ascending: false });
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
export function descontarPendientes(carga: CargaCamion, pendientes: VentaParams[]) {
  const confirmadas = new Set(carga.ventas.map((v) => v.id));
  const unicas = new Map(pendientes.filter((v) => v.carga_id === carga.id && (!v.id || !confirmadas.has(v.id))).map((v) => [v.id, v]));
  const cantidades = sumarProductos([...unicas.values()].flatMap((v) => v.items));
  return carga.cargas_camion_detalle.map((d) => ({ ...d, vendido: Number(d.vendido) + (cantidades.get(d.producto_id) ?? 0) }));
}
export { disponibleCamion };