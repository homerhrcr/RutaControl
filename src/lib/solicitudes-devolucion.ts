import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LineaSolicitud { nombre: string; cantidad: number; motivo: string }
export interface SolicitudDevolucion { id: string; cliente_id: string; cliente: string; fecha: string; items: LineaSolicitud[]; notas: string }

const PREFIJO = "devolucion-telegram:";

/** Lee las líneas «• N × Producto (Motivo)» y la nota «📝 …» del texto guardado. */
export function parsearSolicitud(texto: string): { items: LineaSolicitud[]; notas: string } {
  const items: LineaSolicitud[] = [];
  let notas = "";
  for (const l of texto.split("\n")) {
    const m = l.match(/^•\s*(\d+(?:[.,]\d+)?)\s*×\s*(.+?)\s*\(([^()]*)\)\s*$/);
    if (m) items.push({ cantidad: Number(m[1].replace(",", ".")), nombre: m[2].trim(), motivo: m[3].trim() });
    else if (l.startsWith("📝")) notas = l.replace("📝", "").trim();
  }
  return { items, notas };
}

/** Solicitudes de devolución enviadas por Telegram que aún no se han registrado como devolución. */
export function useSolicitudesDevolucion() {
  return useQuery({
    queryKey: ["solicitudes-devolucion"],
    refetchInterval: 60000,
    queryFn: async (): Promise<SolicitudDevolucion[]> => {
      const { data, error } = await supabase
        .from("telegram_mensajes")
        .select("cliente_id, texto, dedupe_key, created_at, clientes(nombre)")
        .like("dedupe_key", `${PREFIJO}%`)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const ids = (data ?? []).map((m) => (m.dedupe_key as string).slice(PREFIJO.length));
      if (!ids.length) return [];
      const { data: hechas } = await supabase.from("devoluciones").select("id").in("id", ids);
      const procesadas = new Set((hechas ?? []).map((d) => d.id));
      return (data ?? [])
        .map((m: any) => ({ id: m.dedupe_key.slice(PREFIJO.length), cliente_id: m.cliente_id, cliente: m.clientes?.nombre ?? "Cliente", fecha: m.created_at, ...parsearSolicitud(m.texto) }))
        .filter((s) => !procesadas.has(s.id));
    },
  });
}
