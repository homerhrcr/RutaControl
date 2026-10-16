import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Sparkles, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { getFile, queueEvidencia, useOnline } from "@/lib/offline";
import { recomendarDevolucion } from "@/lib/devolucion-ai.functions";
import type { RecomendacionDevolucion } from "@/lib/devolucion-ai";

export interface InspeccionProducto {
  descripcion?: string;
  evidencia_id?: string;
  imagen?: string;
  recomendacion?: RecomendacionDevolucion;
  recomendacion_aplicada?: boolean;
}

async function reducirFoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.8);
}

export function DevolucionInspeccion({ productoId, nombre, devolucionId, value, onChange }: {
  productoId: string; nombre: string; devolucionId: string;
  value: InspeccionProducto;
  onChange: (patch: InspeccionProducto & { destino?: "reingreso" | "merma" }) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const { user, organizacionActiva, roles, isAdmin } = useAuth();
  const online = useOnline();
  const analizar = useServerFn(recomendarDevolucion);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  async function foto(file?: File) {
    if (!file || !user || !organizacionActiva) return;
    generation.current++;
    setError(""); setBusy(true);
    try {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Seleccione una foto JPG, PNG o WebP.");
      if (file.size > 15 * 1024 * 1024) throw new Error("La foto debe pesar menos de 15 MB.");
      const imagen = await reducirFoto(file);
      const evidencia_id = await queueEvidencia({
        file, nombre: `${nombre} — ${file.name}`, entidad: "devoluciones", entidad_id: devolucionId,
        usuario_id: user.id, organization_id: organizacionActiva.id,
      });
      onChange({ imagen, evidencia_id, recomendacion: undefined, recomendacion_aplicada: false });
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar la foto."); }
    finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  }

  async function recomendar() {
    if (!value.imagen || !organizacionActiva) return;
    const current = ++generation.current;
    setBusy(true); setError("");
    try {
      const result = await analizar({ data: {
        organization_id: organizacionActiva.id, producto_id: productoId,
        imagen: value.imagen, descripcion: value.descripcion ?? "",
      } });
      if (current !== generation.current) return;
      if (!result.ok) setError(result.message);
      else onChange({ recomendacion: result.recomendacion, recomendacion_aplicada: false });
    } catch { setError("No se pudo conectar con Lovable AI. La foto y la descripción se conservan."); }
    finally { if (current === generation.current) setBusy(false); }
  }

  return <div className="space-y-2 border-t pt-2">
    <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label={`Foto de ${nombre}`} onChange={(e) => void foto(e.target.files?.[0])} />
    {value.imagen && <img src={value.imagen} alt={`Estado de ${nombre}`} className="h-36 w-full rounded-md object-contain bg-muted" />}
    <Button type="button" variant="outline" disabled={busy} onClick={() => ref.current?.click()} className="gap-2"><Camera className="h-4 w-4" />{value.evidencia_id ? "Cambiar foto" : "Agregar foto"}</Button>
    {value.evidencia_id && <p className="text-xs text-muted-foreground">Foto guardada{online ? "" : " en el dispositivo"}</p>}
    <Textarea aria-label={`Estado de ${nombre}`} placeholder="Estado del producto, empaque, vencimiento y conservación" maxLength={2000} disabled={busy} value={value.descripcion ?? ""} onChange={(e) => { generation.current++; onChange({ descripcion: e.target.value, recomendacion: undefined, recomendacion_aplicada: false }); }} />
    {(roles.includes("vendedor") || isAdmin) && <Button type="button" variant="outline" className="gap-2" disabled={busy || !online || !value.imagen || (value.descripcion?.trim().length ?? 0) < 3} onClick={() => void recomendar()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{busy ? "Procesando…" : "Recomendar con IA"}</Button>}
    {!online && <p className="text-xs text-muted-foreground">El análisis de IA requiere conexión; puede registrar el destino manualmente.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {value.recomendacion && <div className="space-y-2 border-l-2 border-primary pl-3" aria-live="polite">
      <p className="text-sm font-semibold">Recomendación: {value.recomendacion.destino === "merma" ? "Merma" : "Regresa a bodega"}</p>
      <p className="text-sm">{value.recomendacion.razon}</p>
      <p className="text-xs text-muted-foreground">{value.recomendacion.observaciones}</p>
      <p className="text-xs text-muted-foreground">No certifica inocuidad. El responsable confirma el destino.</p>
      <Button type="button" size="sm" variant="outline" className="gap-2" onClick={() => onChange({ destino: value.recomendacion?.destino, recomendacion_aplicada: true })} disabled={value.recomendacion_aplicada}><Check className="h-4 w-4" />{value.recomendacion_aplicada ? "Recomendación aplicada" : "Aplicar recomendación"}</Button>
    </div>}
  </div>;
}

export function FotoDevolucion({ id, nombre }: { id: string; nombre: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    let localUrl = "";
    void (async () => {
      const blob = await getFile(id);
      if (blob) { localUrl = URL.createObjectURL(blob); if (active) setUrl(localUrl); return; }
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.from("evidencias").select("storage_path").eq("id", id).maybeSingle();
      if (!data) return;
      const signed = await supabase.storage.from("evidencias").createSignedUrl(data.storage_path, 600);
      if (active && signed.data) setUrl(signed.data.signedUrl);
    })().catch(() => {});
    return () => { active = false; if (localUrl) URL.revokeObjectURL(localUrl); };
  }, [id]);
  return url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Foto de ${nombre}`} className="h-24 w-32 rounded-md bg-muted object-contain" /></a> : <span className="text-xs text-muted-foreground">Foto pendiente de sincronización</span>;
}