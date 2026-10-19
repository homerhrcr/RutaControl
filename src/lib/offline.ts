import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { registrarVenta, registrarAbono } from "@/lib/data";
import type { CartItem } from "@/lib/data";
import { notificarDocumentoTelegram } from "@/lib/telegram-notificar";

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
  carga_id?: string | null;
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

export interface EvidenciaParams {
  id: string;
  organization_id: string;
  entidad: string;
  entidad_id: string;
  nombre_archivo: string;
  mime_type: string;
  tamano: number;
  sha256: string;
  capturada_en: string;
  latitud: number | null;
  longitud: number | null;
  usuario_id: string;
}

export type OutboxStatus = "PENDING" | "PROCESSING" | "SYNCED" | "FAILED" | "CONFLICT";
export type OutboxEntity = "ventas" | "abonos" | "evidencias" | "pedidos" | "pedido_estado" | "entregas" | "devoluciones";

export interface PedidoParams {
  id: string;
  cliente_id: string;
  ruta_id: string | null;
  fecha_entrega: string;
  total: number;
  notas: string | null;
  usuario_id?: string;
  items: { producto_id: string; nombre: string; cantidad: number; precio: number }[];
}
export interface PedidoEstadoParams { id: string; ids: string[]; estado: string }
export interface EntregaParams { id: string; pedido_id: string; venta: VentaParams }
export interface DevolucionParams { id: string; [k: string]: unknown }
type AnyPayload = VentaParams | AbonoParams | EvidenciaParams | PedidoParams | PedidoEstadoParams | EntregaParams | DevolucionParams;

export interface OutboxOp {
  operation_id: string;
  user_id: string;
  device_id: string;
  entity: OutboxEntity;
  entity_id: string;
  action: "create";
  payload: AnyPayload;
  created_at_local: number;
  status: OutboxStatus;
  retry_count: number;
  last_error: string | null;
  synced_at: number | null;
}

/* ---------------- IndexedDB (outbox + archivos) ---------------- */

const DB_NAME = "ruta_directo";
const STORE = "outbox";
const FILES = "archivos";
const LEGACY_KEY = "lr_offline_ventas";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // v2 agrega el almacén de archivos; la actualización conserva el outbox existente
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: "operation_id" });
        s.createIndex("status", "status");
      }
      if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const r = fn(t.objectStore(store));
    t.oncomplete = () => resolve(r ? (r as IDBRequest<T>).result : undefined);
    t.onerror = () => reject(t.error);
  });
}

export async function allOps(): Promise<OutboxOp[]> {
  const r = await tx<OutboxOp[]>(STORE, "readonly", (s) => s.getAll());
  return (r ?? []).sort((a, b) => a.created_at_local - b.created_at_local);
}
const putOp = (op: OutboxOp) => tx(STORE, "readwrite", (s) => s.put(op));
const deleteOp = (id: string) => tx(STORE, "readwrite", (s) => s.delete(id));
const putFile = (id: string, blob: Blob) => tx(FILES, "readwrite", (s) => s.put(blob, id));
export const getFile = (id: string) => tx<Blob>(FILES, "readonly", (s) => s.get(id));
const deleteFile = (id: string) => tx(FILES, "readwrite", (s) => s.delete(id));

export function deviceId(): string {
  let id = localStorage.getItem("lr_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("lr_device_id", id);
  }
  return id;
}

/* ---------------- Contadores ---------------- */

export interface QueueStats {
  registros: number;
  archivos: number;
  errores: number;
  conflictos: number;
}
const EMPTY: QueueStats = { registros: 0, archivos: 0, errores: 0, conflictos: 0 };
const listeners = new Set<() => void>();
let stats: QueueStats = EMPTY;
let pendingCount = 0;

async function refreshCount() {
  try {
    const ops = await allOps();
    const activos = ops.filter((o) => o.status !== "SYNCED" && o.status !== "CONFLICT");
    stats = {
      registros: activos.filter((o) => o.entity !== "evidencias").length,
      archivos: activos.filter((o) => o.entity === "evidencias").length,
      errores: ops.filter((o) => o.status === "FAILED").length,
      conflictos: ops.filter((o) => o.status === "CONFLICT").length,
    };
    pendingCount = activos.length;
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
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]") as (VentaParams & {
      _localId: string;
      _ts: number;
    })[];
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

async function enqueue(
  entity: OutboxEntity,
  payload: AnyPayload,
  user_id: string,
  ts = Date.now(),
) {
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

export function queuePedido(p: PedidoParams, uid: string) { return enqueue("pedidos", p, uid); }
export function queuePedidoEstado(ids: string[], estado: string, uid: string) {
  return enqueue("pedido_estado", { id: crypto.randomUUID(), ids, estado }, uid);
}
export function queueEntrega(pedido_id: string, venta: VentaParams) {
  return enqueue("entregas", { id: crypto.randomUUID(), pedido_id, venta }, venta.vendedor_id);
}
export function queueDevolucion(p: DevolucionParams, uid: string) { return enqueue("devoluciones", p, uid); }

export function queueAbono(params: AbonoParams) {
  return enqueue("abonos", { ...params, id: params.id ?? crypto.randomUUID() }, params.cobrador_id);
}

async function sha256(blob: Blob): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Guarda la foto en el dispositivo (IndexedDB) y la encola. No requiere internet. */
export async function queueEvidencia(input: {
  file: Blob;
  nombre?: string;
  entidad: string;
  entidad_id: string;
  usuario_id: string;
  organization_id: string;
  lat?: number | null;
  lng?: number | null;
}): Promise<string> {
  const id = crypto.randomUUID();
  const mime = input.file.type || "image/jpeg";
  const meta: EvidenciaParams = {
    id,
    organization_id: input.organization_id,
    entidad: input.entidad,
    entidad_id: input.entidad_id,
    nombre_archivo: input.nombre || `foto-${id}.jpg`,
    mime_type: mime,
    tamano: input.file.size,
    sha256: await sha256(input.file),
    capturada_en: new Date().toISOString(),
    latitud: input.lat ?? null,
    longitud: input.lng ?? null,
    usuario_id: input.usuario_id,
  };
  // Primero el archivo, luego la operación: si se cae entre ambos no queda una operación sin archivo
  await putFile(id, input.file);
  await enqueue("evidencias", meta, input.usuario_id);
  if (navigator.onLine) void syncQueue();
  return id;
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

const LAST_SYNC_KEY = "lr_last_sync_at";
let progress: SyncProgress = {
  syncing: false,
  total: 0,
  done: 0,
  failed: false,
  lastSyncedAt: typeof window !== "undefined" ? Number(localStorage.getItem(LAST_SYNC_KEY)) || null : null,
};
const progressListeners = new Set<() => void>();
function setProgress(patch: Partial<SyncProgress>) {
  progress = { ...progress, ...patch };
  if (patch.lastSyncedAt) localStorage.setItem(LAST_SYNC_KEY, String(patch.lastSyncedAt));
  progressListeners.forEach((l) => l());
}

/* ---------------- Procesadores por entidad ---------------- */

class ConflictError extends Error {
  constructor(
    public conflict_type: string,
    public server_data: unknown,
  ) {
    super(conflict_type);
  }
}

async function registrarConflicto(op: OutboxOp, e: ConflictError) {
  const { error } = await supabase.from("sync_conflicts").upsert(
    {
      operation_id: op.operation_id,
      entity: op.entity,
      entity_id: op.entity_id,
      device_id: op.device_id,
      user_id: op.user_id,
      local_data: op.payload as never,
      server_data: (e.server_data ?? null) as never,
      conflict_type: e.conflict_type,
    },
    { onConflict: "operation_id", ignoreDuplicates: true },
  );
  if (error) throw error;
}

async function procesarAbono(p: AbonoParams) {
  // Idempotencia
  const { data: existe } = await supabase.from("abonos").select("id").eq("id", p.id!).maybeSingle();
  if (existe) return;
  // Detección de conflicto: no se recorta el monto en silencio
  const { data: cred, error } = await supabase
    .from("creditos")
    .select("id, saldo, monto, estado")
    .eq("id", p.credito_id)
    .maybeSingle();
  if (error) throw error;
  if (!cred) throw new ConflictError("credito_inexistente", null);
  if (Number(cred.saldo) <= 0) throw new ConflictError("credito_ya_cancelado", cred);
  if (Number(cred.saldo) + 0.005 < p.monto) throw new ConflictError("abono_mayor_al_saldo", cred);
  await registrarAbono(p);
}

async function procesarEvidencia(p: EvidenciaParams, op: OutboxOp) {
  const { data: existe } = await supabase.from("evidencias").select("id").eq("id", p.id).maybeSingle();
  if (existe) {
    await deleteFile(p.id);
    return;
  }
  const blob = await getFile(p.id);
  if (!blob) throw new Error("Archivo local no encontrado");
  const ext = (p.mime_type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const path = `${p.organization_id}/${p.id}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("evidencias")
    .upload(path, blob, { contentType: p.mime_type, upsert: false });
  // Reintento tras subida previa exitosa: el archivo ya existe → continuar
  if (upErr && !/exist|duplicate/i.test(upErr.message)) throw upErr;
  const { error } = await supabase.from("evidencias").insert({
    id: p.id,
    organization_id: p.organization_id,
    entidad: p.entidad,
    entidad_id: p.entidad_id,
    storage_path: path,
    nombre_archivo: p.nombre_archivo,
    mime_type: p.mime_type,
    tamano: p.tamano,
    sha256: p.sha256,
    capturada_en: p.capturada_en,
    latitud: p.latitud,
    longitud: p.longitud,
    usuario_id: p.usuario_id,
    device_id: op.device_id,
  });
  if (error && error.code !== "23505") throw error;
  // Solo después de la confirmación del servidor se borra la copia local
  await deleteFile(p.id);
}

async function procesarPedido(p: PedidoParams) {
  const { error } = await supabase.from("pedidos").upsert(
    { id: p.id, cliente_id: p.cliente_id, ruta_id: p.ruta_id, fecha_entrega: p.fecha_entrega, total: p.total, notas: p.notas, usuario_id: p.usuario_id },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (error) throw error;
  const { count } = await supabase.from("pedidos_detalle").select("id", { count: "exact", head: true }).eq("pedido_id", p.id);
  if (count) return;
  const { error: e2 } = await supabase.from("pedidos_detalle").insert(
    p.items.map((i) => ({ pedido_id: p.id, producto_id: i.producto_id, nombre_producto: i.nombre, cantidad: i.cantidad, precio_unitario: i.precio })),
  );
  if (e2) throw e2;
}

async function procesarEntrega(p: EntregaParams) {
  const v = await registrarVenta(p.venta);
  const { error } = await supabase.from("pedidos").update({ estado: "entregado", venta_id: v.id }).eq("id", p.pedido_id);
  if (error) throw error;
}

/* ---------------- Sincronización ---------------- */

let syncing = false;

export async function syncQueue(): Promise<number> {
  if (syncing || !navigator.onLine) return 0;
  syncing = true;
  let done = 0;
  try {
    await migrateLegacy();
    const ops = (await allOps()).filter((o) => o.status !== "SYNCED" && o.status !== "CONFLICT");
    setProgress({ syncing: true, total: ops.length, done: 0, failed: false });
    for (const op of ops) {
      await putOp({ ...op, status: "PROCESSING" });
      try {
        if (op.entity === "ventas") await registrarVenta(op.payload as VentaParams);
        else if (op.entity === "abonos") await procesarAbono(op.payload as AbonoParams);
        else if (op.entity === "pedidos") await procesarPedido(op.payload as PedidoParams);
        else if (op.entity === "pedido_estado") {
          const p = op.payload as PedidoEstadoParams;
          const { error } = await supabase.from("pedidos").update({ estado: p.estado }).in("id", p.ids);
          if (error) throw error;
          if (p.estado === "confirmado") for (const id of p.ids) await notificarDocumentoTelegram("pedido", id);
        } else if (op.entity === "entregas") await procesarEntrega(op.payload as EntregaParams);
        else if (op.entity === "devoluciones") {
          const { error } = await supabase.rpc("registrar_devolucion", { p: op.payload as never });
          if (error) throw error;
        } else await procesarEvidencia(op.payload as EvidenciaParams, op);
        await deleteOp(op.operation_id);
        done++;
        setProgress({ done });
      } catch (e: any) {
        if (e instanceof ConflictError) {
          try {
            await registrarConflicto(op, e);
            await putOp({ ...op, status: "CONFLICT", last_error: e.conflict_type });
            done++;
            setProgress({ done });
            continue;
          } catch (e2: any) {
            e = e2;
          }
        }
        // Se conserva en el dispositivo y se reintenta luego (en orden, sin pérdida)
        await putOp({
          ...op,
          status: "FAILED",
          retry_count: op.retry_count + 1,
          last_error: String(e?.message ?? e),
        });
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

/** Descarta del dispositivo una operación en conflicto (ya registrada en el servidor). */
export async function descartarConflictoLocal(operation_id: string) {
  const op = (await allOps()).find((o) => o.operation_id === operation_id);
  if (!op || op.status !== "CONFLICT") return;
  await deleteOp(operation_id);
  await refreshCount();
}

/* ---------------- Server → dispositivo (incremental) ---------------- */

const CURSOR_KEY = "lr_sync_cursor";

/**
 * Consulta solo qué tablas cambiaron desde el último cursor confirmado y
 * devuelve sus nombres para refrescar únicamente esas consultas.
 */
export async function pullCambios(orgId: string | null): Promise<string[]> {
  if (!navigator.onLine || !orgId) return [];
  const key = `${CURSOR_KEY}_${orgId}`;
  const desde = localStorage.getItem(key);
  const { data, error } = await supabase.rpc("cambios_desde", {
    p_desde: desde ?? new Date(0).toISOString(),
  });
  if (error) throw error;
  const rows = (data ?? []) as { entidad: string; cambios: number; ultimo: string | null }[];
  const cambiadas = rows.filter((r) => Number(r.cambios) > 0);
  const max = cambiadas.reduce<string | null>((m, r) => (r.ultimo && (!m || r.ultimo > m) ? r.ultimo : m), desde);
  if (max) localStorage.setItem(key, max);
  // Primera vez: no se fuerza recarga (los datos ya se bajaron al abrir)
  return desde ? cambiadas.map((r) => r.entidad) : [];
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

export function useQueueStats(): QueueStats {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => stats,
    () => EMPTY,
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
