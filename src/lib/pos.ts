import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
export function useCajasPOS() {
  const { user, organizacionActiva } = useAuth();
  return useQuery({ queryKey: ["pos-cajas", organizacionActiva?.id, user?.id], enabled: !!user && !!organizacionActiva, queryFn: async () => {
    if (!user) return [];
    const { data, error } = await supabase.from("pos_cajas").select("*").eq("usuario_id", user.id).order("apertura", { ascending: false });
    if (error) throw error; return data;
  } });
}
export function useVentasPOS(cajaId?: string) {
  return useQuery({ queryKey: ["pos-ventas", cajaId], enabled: !!cajaId, refetchInterval: 15000, queryFn: async () => {
    if (!cajaId) return [];
    const { data, error } = await supabase.from("ventas").select("*, detalle_ventas(*)").eq("pos_caja_id", cajaId).order("fecha", { ascending: false });
    if (error) throw error; return data;
  } });
}