import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  allOps,
  descartarConflictoLocal,
  syncQueue,
  useOnline,
  useQueueStats,
  useSyncProgress,
  type OutboxOp,
} from "@/lib/offline";

export const Route = createFileRoute("/_authenticated/sincronizacion")({
  head: () => ({
    meta: [
      { title: "Sincronización · Ruta Directo" },
      { name: "description", content: "Estado de la sincronización y operaciones pendientes del dispositivo." },
      { property: "og:title", content: "Sincronización · Ruta Directo" },
      { property: "og:description", content: "Estado de la sincronización y operaciones pendientes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SincronizacionPage,
});

const NOMBRE: Record<string, string> = { ventas: "Venta", abonos: "Abono", evidencias: "Foto" };
const TIPO: Record<string, string> = {
  credito_inexistente: "El crédito ya no existe",
  credito_ya_cancelado: "El crédito ya estaba pagado",
  abono_mayor_al_saldo: "El abono supera el saldo actual",
};

function SincronizacionPage() {
  const online = useOnline();
  const stats = useQueueStats();
  const progress = useSyncProgress();
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const [ops, setOps] = useState<OutboxOp[]>([]);

  useEffect(() => {
    void allOps().then(setOps);
  }, [stats, progress.syncing]);

  const conflictos = useQuery({
    queryKey: ["sync_conflicts"],
    enabled: online,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_conflicts")
        .select("*")
        .eq("status", "OPEN")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function resolver(id: string, operation_id: string, status: "RESOLVED" | "DISMISSED") {
    const { error } = await supabase
      .from("sync_conflicts")
      .update({
        status,
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id,
        resolution: status === "RESOLVED" ? "Revisado y corregido manualmente" : "Descartado",
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    await descartarConflictoLocal(operation_id);
    qc.invalidateQueries({ queryKey: ["sync_conflicts"] });
    toast.success("Conflicto actualizado");
  }

  const pendientes = ops.filter((o) => o.status !== "CONFLICT");

  return (
    <div className="space-y-4">
      <PageHeader title="Sincronización" />
      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          {online ? <Wifi className="h-5 w-5 text-success" /> : <WifiOff className="h-5 w-5 text-destructive" />}
          <span className="font-semibold">
            Estado: {!online ? "Sin conexión" : progress.syncing ? "Sincronizando" : stats.errores ? "Error" : "Conectado"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Stat label="Registros pendientes" value={stats.registros} />
          <Stat label="Fotos pendientes" value={stats.archivos} />
          <Stat label="Errores" value={stats.errores} />
          <Stat label="Conflictos" value={stats.conflictos} />
        </div>
        <p className="text-xs text-muted-foreground">
          Última sincronización: {progress.lastSyncedAt ? new Date(progress.lastSyncedAt).toLocaleString() : "—"}
        </p>
        <Button className="w-full gap-2" disabled={!online || progress.syncing} onClick={() => void syncQueue()}>
          <RefreshCw className={progress.syncing ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Sincronizar ahora
        </Button>
      </Card>

      <Card className="p-4">
        <h2 className="mb-2 font-semibold">En este dispositivo</h2>
        {pendientes.length === 0 && <p className="text-sm text-muted-foreground">Nada pendiente.</p>}
        <ul className="space-y-2">
          {pendientes.map((o) => (
            <li key={o.operation_id} className="flex items-center justify-between rounded border p-2 text-sm">
              <span>
                {NOMBRE[o.entity]} · {new Date(o.created_at_local).toLocaleString()}
                {o.last_error && <span className="block text-xs text-destructive">{o.last_error}</span>}
              </span>
              <Badge variant={o.status === "FAILED" ? "destructive" : "secondary"}>
                {o.status === "FAILED" ? `Error (${o.retry_count})` : "Pendiente"}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-4">
        <h2 className="mb-2 font-semibold">Conflictos abiertos</h2>
        {!online && <p className="text-sm text-muted-foreground">Conéctate para ver los conflictos.</p>}
        {online && (conflictos.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No hay conflictos.</p>
        )}
        <ul className="space-y-2">
          {(conflictos.data ?? []).map((c) => {
            const local = c.local_data as any;
            const server = c.server_data as any;
            return (
              <li key={c.id} className="space-y-1 rounded border p-2 text-sm">
                <div className="font-medium">
                  {NOMBRE[c.entity] ?? c.entity}: {TIPO[c.conflict_type] ?? c.conflict_type}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleString()}
                  {local?.monto != null && ` · Monto en el dispositivo: ${local.monto}`}
                  {server?.saldo != null && ` · Saldo en el servidor: ${server.saldo}`}
                </div>
                {isAdmin && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={() => resolver(c.id, c.operation_id, "RESOLVED")}>
                      Marcar resuelto
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => resolver(c.id, c.operation_id, "DISMISSED")}>
                      Descartar
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
