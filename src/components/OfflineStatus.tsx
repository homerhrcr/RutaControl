import { Wifi, WifiOff, RefreshCw, CheckCircle2, CloudOff, AlertTriangle, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOfflineQueue, useSyncProgress, syncQueue } from "@/lib/offline";

function timeAgo(ts: number | null): string {
  if (!ts) return "—";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "hace unos segundos";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return new Date(ts).toLocaleString();
}

export function OfflineStatus() {
  const { online, count } = useOfflineQueue();
  const progress = useSyncProgress();

  const syncing = progress.syncing;
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  // Determine indicator state
  let tone: "ok" | "warning" | "destructive" = "ok";
  let Icon = Wifi;
  let shortLabel = "En línea";

  if (!online) {
    tone = "destructive";
    Icon = WifiOff;
    shortLabel = count > 0 ? `Offline · ${count}` : "Offline";
  } else if (syncing) {
    tone = "warning";
    Icon = RefreshCw;
    shortLabel = `Sincronizando ${progress.done}/${progress.total}`;
  } else if (count > 0) {
    tone = "warning";
    Icon = Clock;
    shortLabel = `${count} en cola`;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Estado de conexión y sincronización"
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
            tone === "ok" && "bg-muted text-muted-foreground hover:bg-muted/80",
            tone === "warning" && "bg-warning/20 text-warning hover:bg-warning/30",
            tone === "destructive" && "bg-destructive/15 text-destructive hover:bg-destructive/25",
          )}
        >
          <Icon className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
          <span className="hidden sm:inline">{shortLabel}</span>
          {(count > 0 || !online) && (
            <span className="sm:hidden inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-current/20 px-1 text-[10px]">
              {count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="space-y-4">
          {/* Connection state */}
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full",
                online ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
              )}
            >
              {online ? <Wifi className="h-5 w-5" /> : <CloudOff className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-sm font-semibold">
                {online ? "Con conexión" : "Sin conexión"}
              </p>
              <p className="text-xs text-muted-foreground">
                {online
                  ? "Los datos se guardan en el servidor"
                  : "Trabajando offline · los cambios se guardan en el dispositivo"}
              </p>
            </div>
          </div>

          {/* Queue */}
          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Operaciones en cola</span>
              <span className="text-sm font-semibold">{count}</span>
            </div>

            {syncing && (
              <div className="mt-3 space-y-1.5">
                <Progress value={pct} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Sincronizando {progress.done} de {progress.total}…
                </p>
              </div>
            )}

            {!syncing && progress.failed && count > 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                No se pudo sincronizar todo. Se reintentará automáticamente.
              </p>
            )}

            {!syncing && count === 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Todo sincronizado
              </p>
            )}
          </div>

          {/* Last sync */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Última sincronización</span>
            <span>{timeAgo(progress.lastSyncedAt)}</span>
          </div>

          {/* Manual sync */}
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={!online || syncing || count === 0}
            onClick={() => void syncQueue()}
          >
            <RefreshCw className={cn("mr-2 h-3.5 w-3.5", syncing && "animate-spin")} />
            Sincronizar ahora
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
