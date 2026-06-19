import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useCreditosPendientes, useInvalidate } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { AbonoDialog } from "@/components/AbonoDialog";
import { HistorialCliente } from "@/components/HistorialCliente";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCRC, formatDate, daysBetween, agingBucket } from "@/lib/format";
import { HandCoins, Phone, AlertTriangle, Receipt } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cobranza")({
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
  const rows = [...map.values()].sort((a, b) => b.saldo - a.saldo);
  const total = rows.reduce((s, r) => s + r.saldo, 0);

  // antigüedad de saldos (cartera de crédito)
  const buckets: Record<string, number> = { "0-30 días": 0, "31-60 días": 0, "61-90 días": 0, "+90 días": 0 };
  for (const c of creditos ?? []) buckets[agingBucket(daysBetween((c as any).fecha))] += Number(c.saldo);

  return (
    <div>
      <PageHeader title="Cobros y Crédito" subtitle={`Pendiente total: ${formatCRC(total)}`} />
      <div className="space-y-4 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Object.entries(buckets).map(([k, v]) => (
            <Card key={k} className="p-3">
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className="truncate text-lg font-black">{formatCRC(v)}</p>
            </Card>
          ))}
        </div>

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
                  {r.cliente.telefono && (
                    <a
                      href={`https://wa.me/506${r.cliente.telefono.replace(/\D/g, "")}?text=${encodeURIComponent(
                        `Hola ${r.cliente.nombre}, le recordamos su saldo pendiente de ${formatCRC(r.saldo)} con Lácteos La Rivera.`,
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent"
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </Card>
            );
          })}
          {rows.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Sin saldos pendientes 🎉</p>}
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
        onClose={() => setHistorialClient(null)}
      />
    </div>
  );
}
