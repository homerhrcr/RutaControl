import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatCRC } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/facturas-eliminadas")({
  head: () => ({
    meta: [
      { title: "Facturas eliminadas — Ruta Directo" },
      { name: "description", content: "Histórico de facturas eliminadas con motivo y responsable." },
      { property: "og:title", content: "Facturas eliminadas — Ruta Directo" },
      { property: "og:description", content: "Histórico de facturas eliminadas con motivo y responsable." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FacturasEliminadas,
});

const fmt = (f?: string | null) => (f ? new Date(f).toLocaleString("es-CR", { dateStyle: "medium", timeStyle: "short" }) : "—");

function FacturasEliminadas() {
  const { isAdmin } = useAuth();
  const [q, setQ] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["facturas-eliminadas"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("facturas_eliminadas").select("*").order("eliminada_en", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });
  if (!isAdmin) return <div className="p-4 text-sm text-muted-foreground">Solo administradores.</div>;
  const t = q.trim().toLowerCase();
  const lista = data.filter((f: any) => !t || [f.cliente_nombre, f.ruta_nombre, f.motivo, f.eliminada_por_nombre].some((x) => (x ?? "").toLowerCase().includes(t)));
  return (
    <div>
      <PageHeader title="Facturas eliminadas" subtitle="Histórico con motivo y responsable" />
      <div className="space-y-3 p-4">
        <Input placeholder="Buscar cliente, ruta, motivo o usuario" value={q} onChange={(e) => setQ(e.target.value)} />
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {!isLoading && lista.length === 0 && <p className="text-sm text-muted-foreground">No hay facturas eliminadas.</p>}
        {lista.map((f: any) => {
          const det: any[] = f.datos?.detalle ?? [];
          return (
            <Card key={f.id} className="p-3 space-y-1 cursor-pointer" onClick={() => setAbierta(abierta === f.id ? null : f.id)}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{f.cliente_nombre ?? "Sin cliente"}</p>
                  <p className="text-xs text-muted-foreground">Venta: {fmt(f.fecha_venta)}{f.ruta_nombre ? ` · ${f.ruta_nombre}` : ""}</p>
                </div>
                <div className="text-right">
                  <p className="font-black line-through">{formatCRC(Number(f.total))}</p>
                  <Badge variant="destructive">Eliminada</Badge>
                </div>
              </div>
              <p className="text-sm"><span className="font-medium">Motivo:</span> {f.motivo}</p>
              <p className="text-xs text-muted-foreground">Eliminada por {f.eliminada_por_nombre ?? "—"} el {fmt(f.eliminada_en)} · {f.metodo_pago === "credito" ? "Crédito" : "Contado"}</p>
              {abierta === f.id && (
                <div className="mt-2 border-t pt-2 text-sm">
                  {det.map((d) => (
                    <div key={d.id} className="flex justify-between"><span>{Number(d.cantidad)}× {d.nombre_producto}</span><span>{formatCRC(Number(d.total_linea))}</span></div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
