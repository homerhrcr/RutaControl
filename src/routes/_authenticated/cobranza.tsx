import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useCreditosPendientes, useInvalidate } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { AbonoDialog } from "@/components/AbonoDialog";
import { HistorialCliente } from "@/components/HistorialCliente";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCRC, formatDate, daysBetween, agingBucket } from "@/lib/format";
import { Search, HandCoins, Phone, AlertTriangle, Receipt } from "lucide-react";
import { TelegramEnviar } from "@/components/TelegramCliente";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cobranza")({
  head: () => ({
    meta: [
      { title: "Crédito y Cobros — Ruta Directo" },
      { name: "description", content: "Deudas y abonos de clientes de Ruta Directo." },
      { property: "og:title", content: "Crédito y Cobros — Ruta Directo" },
      { property: "og:description", content: "Deudas y abonos de clientes de Ruta Directo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CobranzaPage,
});

export function CobranzaPage() {
  const { data: creditos } = useCreditosPendientes();
  const invalidate = useInvalidate();
  const [abonoClient, setAbonoClient] = useState<any | null>(null);
  const [historialClient, setHistorialClient] = useState<any | null>(null);

  // agrupar por cliente
  const map = new Map<string, { cliente: any; saldo: number; vence: string | null }>();
  for (const c of creditos ?? []) {
    const cl = (c as any).clientes;
    if (!c.cliente_id || !cl) continue;
    const prev = map.get(c.cliente_id);
    map.set(c.cliente_id, {
      cliente: { id: c.cliente_id, nombre: cl.nombre, telefono: cl.telefono },
      saldo: (prev?.saldo ?? 0) + Number(c.saldo),
      vence: c.fecha_limite ?? prev?.vence ?? null,
    });
  }
  const [q, setQ] = useState("");
  const norm = (t: string) => (t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const allRows = [...map.values()].sort((a, b) => b.saldo - a.saldo);
  const rows = q.trim()
    ? allRows.filter((r) => norm(`${r.cliente.nombre} ${r.cliente.telefono ?? ""}`).includes(norm(q.trim())))
    : allRows;
  const total = allRows.reduce((s, r) => s + r.saldo, 0);

  // antigüedad de saldos (cartera de crédito)
  const buckets: Record<string, number> = { "0-30 días": 0, "31-60 días": 0, "61-90 días": 0, "+90 días": 0 };
  for (const c of creditos ?? []) buckets[agingBucket(daysBetween((c as any).fecha))] += Number(c.saldo);

  return (
    <div>
      <PageHeader title="Crédito y Cobros" subtitle={`Pendiente total: ${formatCRC(total)}`} />
      <div className="space-y-4 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Object.entries(buckets).map(([k, v]) => (
            <Card key={k} className="p-3">
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className="truncate text-lg font-black">{formatCRC(v)}</p>
            </Card>
          ))}
        </div>
        <CreditosRuta />

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-11 pl-9" placeholder="Buscar cliente o teléfono…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {q && <p className="text-xs text-muted-foreground">{rows.length} resultado(s)</p>}
        <div className="space-y-2.5">
          {rows.map((r) => {
            const venc = r.vence ? daysBetween(r.vence, new Date()) > 0 : false;
            return (
              <Card key={r.cliente.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{r.cliente.nombre}</p>
                    <p className="text-xs text-muted-foreground">Vence: {formatDate(r.vence)}</p>
                    {venc && (
                      <Badge variant="outline" className="mt-1 border-destructive/40 text-destructive">
                        <AlertTriangle className="mr-1 h-3 w-3" /> Vencido
                      </Badge>
                    )}
                  </div>
                  <p className="shrink-0 text-lg font-black text-destructive">{formatCRC(r.saldo)}</p>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button className="h-11 flex-1 gap-1.5" onClick={() => setAbonoClient(r.cliente)}>
                    <HandCoins className="h-4 w-4" /> Registrar abono
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 flex-1 gap-1.5"
                    onClick={() => setHistorialClient(r.cliente)}
                  >
                    <Receipt className="h-4 w-4" /> Ver detalle de deuda
                  </Button>
                  <TelegramEnviar iconOnly clienteId={r.cliente.id} texto={`Hola ${r.cliente.nombre}, le recordamos su saldo pendiente de ${formatCRC(r.saldo)} con Ruta Directo.`} />
                </div>
              </Card>
            );
          })}
          {rows.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{q ? "Ningún cliente coincide" : "Sin saldos pendientes 🎉"}</p>}
        </div>
      </div>
      <AbonoDialog
        cliente={abonoClient}
        open={!!abonoClient}
        onClose={() => setAbonoClient(null)}
        onDone={() => invalidate(["creditos-pendientes", "saldos-map", "resumen-dia"])}
      />
      <HistorialCliente
        cliente={historialClient}
        open={!!historialClient}
        soloDeuda
        onClose={() => setHistorialClient(null)}
      />
    </div>
  );
}

function CreditosRuta() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [montos, setMontos] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["creditos-ruta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creditos")
        .select("id, fecha, saldo, monto, rutas(nombre)")
        .not("ruta_id", "is", null)
        .gt("saldo", 0)
        .order("fecha");
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!data?.length) return null;
  async function abonar(id: string, saldo: number) {
    const m = montos[id] ?? 0;
    if (m <= 0 || m > saldo) return toast.error("El abono debe ser mayor a cero y no superar el saldo");
    setBusy(id);
    const { error } = await supabase.rpc("abonar_credito_ruta", { p: { id: crypto.randomUUID(), credito_id: id, monto: m } });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`Abono registrado · ${formatCRC(m)}`);
    setMontos((s) => ({ ...s, [id]: 0 }));
    qc.invalidateQueries({ queryKey: ["creditos-ruta"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }
  return (
    <Card className="space-y-2 p-3">
      <p className="font-semibold">Crédito por ruta</p>
      {data.map((c: any) => (
        <div key={c.id} className="flex flex-wrap items-center gap-2 border-t pt-2 text-sm">
          <span className="min-w-0 flex-1">{c.rutas?.nombre ?? "Ruta"} · {formatDate(c.fecha)}</span>
          <span className="font-black text-destructive">{formatCRC(c.saldo)}</span>
          {isAdmin && (
            <>
              <Input type="number" inputMode="numeric" className="h-9 w-28" placeholder="₡0" value={montos[c.id] || ""} onChange={(e) => setMontos((s) => ({ ...s, [c.id]: Number(e.target.value) || 0 }))} />
              <Button size="sm" disabled={busy === c.id} onClick={() => abonar(c.id, Number(c.saldo))}>Abonar</Button>
            </>
          )}
        </div>
      ))}
    </Card>
  );
}
