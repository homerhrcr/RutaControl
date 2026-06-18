import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCRC, formatDate, daysBetween, agingBucket } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/credito")({
  component: CreditoPage,
});

function CreditoPage() {
  const { data } = useQuery({
    queryKey: ["creditos-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creditos")
        .select("*, clientes(nombre)")
        .gt("saldo", 0)
        .order("fecha_limite");
      if (error) throw error;
      return data;
    },
  });

  const buckets: Record<string, number> = { "0-30 días": 0, "31-60 días": 0, "61-90 días": 0, "+90 días": 0 };
  for (const c of data ?? []) buckets[agingBucket(daysBetween(c.fecha))] += Number(c.saldo);

  return (
    <div>
      <PageHeader title="Cartera de Crédito" subtitle="Antigüedad de saldos" />
      <div className="space-y-4 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Object.entries(buckets).map(([k, v]) => (
            <Card key={k} className="p-3">
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className="truncate text-lg font-black">{formatCRC(v)}</p>
            </Card>
          ))}
        </div>
        <div className="space-y-2">
          {(data ?? []).map((c) => {
            const vencido = c.fecha_limite && new Date(c.fecha_limite) < new Date();
            return (
              <Card key={c.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{(c as any).clientes?.nombre ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    Crédito {formatDate(c.fecha)} · Vence {formatDate(c.fecha_limite)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-black text-destructive">{formatCRC(c.saldo)}</p>
                  <Badge variant={vencido ? "outline" : "secondary"} className={vencido ? "border-destructive/40 text-destructive" : ""}>
                    {vencido ? "Vencido" : "Al día"}
                  </Badge>
                </div>
              </Card>
            );
          })}
          {(data ?? []).length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Sin créditos activos.</p>}
        </div>
      </div>
    </div>
  );
}
