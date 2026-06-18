import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRutas } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { formatCRC } from "@/lib/format";
import { Map } from "lucide-react";

export const Route = createFileRoute("/_authenticated/rutas")({
  component: RutasPage,
});

function RutasPage() {
  const { data: rutas } = useRutas();
  const { data } = useQuery({
    queryKey: ["rutas-stats"],
    queryFn: async () => {
      const [{ data: ventas }, { data: clientes }] = await Promise.all([
        supabase.from("ventas").select("ruta_id, total"),
        supabase.from("clientes").select("ruta_id"),
      ]);
      const v: Record<string, { total: number; n: number }> = {};
      for (const x of ventas ?? []) {
        if (!x.ruta_id) continue;
        v[x.ruta_id] = { total: (v[x.ruta_id]?.total ?? 0) + Number(x.total), n: (v[x.ruta_id]?.n ?? 0) + 1 };
      }
      const c: Record<string, number> = {};
      for (const x of clientes ?? []) if (x.ruta_id) c[x.ruta_id] = (c[x.ruta_id] ?? 0) + 1;
      return { v, c };
    },
  });

  return (
    <div>
      <PageHeader title="Rutas de Distribución" subtitle="Comparativo por ruta" />
      <div className="grid gap-4 p-4 md:grid-cols-2 md:p-6">
        {(rutas ?? []).map((r) => {
          const s = data?.v[r.id];
          return (
            <Card key={r.id} className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                  <Map className="h-5 w-5" />
                </div>
                <h2 className="font-bold">{r.nombre}</h2>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="text-lg font-black">{formatCRC(s?.total ?? 0)}</p><p className="text-xs text-muted-foreground">Ingresos</p></div>
                <div><p className="text-lg font-black">{s?.n ?? 0}</p><p className="text-xs text-muted-foreground">Ventas</p></div>
                <div><p className="text-lg font-black">{data?.c[r.id] ?? 0}</p><p className="text-xs text-muted-foreground">Clientes</p></div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
