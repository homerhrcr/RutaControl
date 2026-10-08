import { useEffect, useSyncExternalStore } from "react";
import { registrarVenta, registrarAbono } from "@/lib/data";
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
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

/* ---------------- Types ---------------- */

export interface VentaParams {
  id?: string;
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

export interface AbonoParams {
  id?: string;
  credito_id: string;
  cliente_id: string;
  monto: number;
  cobrador_id: string;
  saldoActual: number;
}

export type OutboxStatus = "PENDING" | "PROCESSING" | "SYNCED" | "FAILED" | "CONFLICT";

export interface OutboxOp {
  operation_id: string;
  user_id: string;
  device_id: string;
  entity: "ventas" | "abonos";
  entity_id: string;
  action: "create";
  payload: VentaParams | AbonoParams;
  created_at_local: number;
  status: OutboxStatus;
  retry_count: number;
  last_error: string | null;
  synced_at: number | null;
}

/* ---------------- IndexedDB (outbox persistente) ---------------- */

const DB_NAME = "ruta_directo";
const STORE = "outbox";
const LEGACY_KEY = "lr_offline_ventas";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: "operation_id" });
        s.createIndex("status", "status");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(r ? (r as IDBRequest<T>).result : undefined);
    t.onerror = () => reject(t.error);
  });
}

async function allOps(): Promise<OutboxOp[]> {
  const r = await tx<OutboxOp[]>("readonly", (s) => s.getAll());
  return (r ?? []).sort((a, b) => a.created_at_local - b.created_at_local);
}
const putOp = (op: OutboxOp) => tx("readwrite", (s) => s.put(op));
const deleteOp = (id: string) => tx("readwrite", (s) => s.delete(id));

function deviceId(): string {
  let id = localStorage.getItem("lr_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("lr_device_id", id);
  }
  return id;
}

/* ---------------- Pending count store ---------------- */

const listeners = new Set<() => void>();
let pendingCount = 0;
async function refreshCount() {
  try {
    const ops = await allOps();
    pendingCount = ops.filter((o) => o.status !== "SYNCED").length;
  } catch {
    /* IndexedDB no disponible */
  }
  listeners.forEach((l) => l());
}

let migrated = false;
async function migrateLegacy() {
  if (migrated || typeof window === "undefined") return;
  migrated = true;
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]") as (VentaParams & { _localId: string; _ts: number })[];
    for (const v of legacy) {
      const { _localId, _ts, ...p } = v;
      await enqueue("ventas", { ...p, id: p.id ?? _localId }, p.vendedor_id, _ts);
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
  await refreshCount();
}

async function enqueue(entity: OutboxOp["entity"], payload: VentaParams | AbonoParams, user_id: string, ts = Date.now()) {
  const entity_id = payload.id ?? crypto.randomUUID();
  await putOp({
    operation_id: crypto.randomUUID(),
    user_id,
    device_id: deviceId(),
    entity,
    entity_id,
    action: "create",
    payload: { ...payload, id: entity_id },
    created_at_local: ts,
    status: "PENDING",
    retry_count: 0,
    last_error: null,
    synced_at: null,
  });
  await refreshCount();
}

export function queueVenta(params: VentaParams) {
  return enqueue("ventas", { ...params, id: params.id ?? crypto.randomUUID() }, params.vendedor_id);
}

export function queueAbono(params: AbonoParams) {
  return enqueue("abonos", { ...params, id: params.id ?? crypto.randomUUID() }, params.cobrador_id);
}

export function getQueueCount(): number {
  return pendingCount;
}

/* ---------------- Sync progress ---------------- */

export interface SyncProgress {
  syncing: boolean;
  total: number;
  done: number;
  failed: boolean;
  lastSyncedAt: number | null;
}

let progress: SyncProgress = { syncing: false, total: 0, done: 0, failed: false, lastSyncedAt: null };
const progressListeners = new Set<() => void>();
function setProgress(patch: Partial<SyncProgress>) {
  progress = { ...progress, ...patch };
  progressListeners.forEach((l) => l());
}

let syncing = false;

export async function syncQueue(): Promise<number> {
  if (syncing || !navigator.onLine) return 0;
  syncing = true;
  let done = 0;
  try {
    await migrateLegacy();
    const ops = (await allOps()).filter((o) => o.status !== "SYNCED");
    setProgress({ syncing: true, total: ops.length, done: 0, failed: false });
    for (const op of ops) {
      await putOp({ ...op, status: "PROCESSING" });
      try {
        if (op.entity === "ventas") await registrarVenta(op.payload as VentaParams);
        else await registrarAbono(op.payload as AbonoParams);
        await deleteOp(op.operation_id);
        done++;
        setProgress({ done });
      } catch (e: any) {
        // Se conserva en el dispositivo y se reintenta luego (en orden, sin pérdida)
        await putOp({ ...op, status: "FAILED", retry_count: op.retry_count + 1, last_error: String(e?.message ?? e) });
        setProgress({ failed: true });
        break;
      }
    }
  } finally {
    syncing = false;
    await refreshCount();
    setProgress({ syncing: false, lastSyncedAt: done > 0 ? Date.now() : progress.lastSyncedAt });
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
      return () => listeners.delete(cb);
    },
    () => pendingCount,
    () => 0,
  );

  useEffect(() => {
    void migrateLegacy();
  }, []);

  useEffect(() => {
    if (online && count > 0) void syncQueue();
  }, [online, count]);

  // Reintento periódico mientras haya pendientes
  useEffect(() => {
    if (!online || count === 0) return;
    const t = setInterval(() => void syncQueue(), 60000);
    return () => clearInterval(t);
  }, [online, count]);

  return { online, count };
}
