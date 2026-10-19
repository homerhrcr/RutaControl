import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { pullCambios, useOnline, useSyncProgress } from "@/lib/offline";

/** Al reconectar (y tras subir el outbox) refresca solo las consultas de tablas que cambiaron. */
export function useIncrementalPull() {
  const qc = useQueryClient();
  const online = useOnline();
  const { organizacionActiva } = useAuth();
  const { syncing, lastSyncedAt } = useSyncProgress();
  const orgId = organizacionActiva?.id ?? null;

  useEffect(() => {
    if (!online || syncing || !orgId) return;
    let cancel = false;
    const run = async () => {
      try {
        const tablas = await pullCambios(orgId);
        if (cancel || tablas.length === 0) return;
        const claves = tablas.flatMap((t) =>
          t === "listas_precios" ? ["listas_precios", "precios_productos"] : t === "clientes" ? ["clientes", "cliente"] : t === "cliente_rutas" ? ["clientes"] : t === "abonos" ? ["abonos", "creditos"] : [t.replace(/s$/, ""), t],
        );
        qc.invalidateQueries({
          predicate: (q) => {
            const k = String(q.queryKey[0] ?? "").toLowerCase();
            return claves.some((c) => k.includes(c)) || k.includes("dashboard") || k.includes("reporte");
          },
        });
      } catch {
        /* se reintenta en el próximo ciclo */
      }
    };
    void run();
    const t = setInterval(run, 120000);
    return () => {
      cancel = true;
      clearInterval(t);
    };
  }, [online, syncing, orgId, lastSyncedAt, qc]);
}
