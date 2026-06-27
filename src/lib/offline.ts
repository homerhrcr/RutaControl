import { useEffect, useSyncExternalStore } from "react";
import { registrarVenta } from "@/lib/data";
import type { CartItem } from "@/lib/data";

/* ---------------- Online status ---------------- */

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

/* ---------------- Offline sale queue ---------------- */

const QUEUE_KEY = "lr_offline_ventas";

export interface VentaParams {
  cliente_id: string;
  cliente_nombre?: string;
  ruta_id: string | null;
  vendedor_id: string;
  items: CartItem[];
  descuento: number;
  metodo: "contado" | "credito";
  fecha_limite?: string | null;
  lat?: number | null;
  lng?: number | null;
}

interface QueuedVenta extends VentaParams {
  _localId: string;
  _ts: number;
}

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

function readQueue(): QueuedVenta[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeQueue(q: QueuedVenta[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  emit();
}

export function queueVenta(params: VentaParams) {
  const q = readQueue();
  q.push({ ...params, _localId: crypto.randomUUID(), _ts: Date.now() });
  writeQueue(q);
}

export function getQueueCount(): number {
  return readQueue().length;
}

/* ---------------- Sync progress ---------------- */

export interface SyncProgress {
  syncing: boolean;
  total: number;
  done: number;
  failed: boolean;
  lastSyncedAt: number | null;
}

let progress: SyncProgress = {
  syncing: false,
  total: 0,
  done: 0,
  failed: false,
  lastSyncedAt: null,
};

const progressListeners = new Set<() => void>();
function emitProgress() {
  progressListeners.forEach((l) => l());
}
function setProgress(patch: Partial<SyncProgress>) {
  progress = { ...progress, ...patch };
  emitProgress();
}

let syncing = false;

export async function syncQueue(): Promise<number> {
  if (syncing || !navigator.onLine) return 0;
  syncing = true;
  let done = 0;
  const start = readQueue();
  setProgress({ syncing: true, total: start.length, done: 0, failed: false });
  try {
    let q = readQueue();
    for (const item of [...q]) {
      try {
        await registrarVenta({
          cliente_id: item.cliente_id,
          ruta_id: item.ruta_id,
          vendedor_id: item.vendedor_id,
          items: item.items,
          descuento: item.descuento,
          metodo: item.metodo,
          fecha_limite: item.fecha_limite,
          lat: item.lat,
          lng: item.lng,
        });
        q = q.filter((x) => x._localId !== item._localId);
        writeQueue(q);
        done++;
        setProgress({ done });
      } catch {
        // stop on first failure; will retry next time
        setProgress({ failed: true });
        break;
      }
    }
  } finally {
    syncing = false;
    setProgress({
      syncing: false,
      lastSyncedAt: done > 0 ? Date.now() : progress.lastSyncedAt,
    });
  }
  return done;
}

export function useSyncProgress(): SyncProgress {
  return useSyncExternalStore(
    (cb) => {
      progressListeners.add(cb);
      return () => progressListeners.delete(cb);
    },
    () => progress,
    () => progress,
  );
}


/* ---------------- Hook for components ---------------- */

export function useOfflineQueue() {
  const online = useOnline();
  const count = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      window.addEventListener("storage", cb);
      return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", cb);
      };
    },
    () => readQueue().length,
    () => 0,
  );

  useEffect(() => {
    if (online && count > 0) void syncQueue();
  }, [online, count]);

  return { online, count };
}
