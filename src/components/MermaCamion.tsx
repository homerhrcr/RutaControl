import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { validarMermaCamion, enCamion } from "@/lib/carga-camion-calculos";
import type { descontarPendientes } from "@/lib/carga-camion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function MermaCamion({ cargaId, detalle, onClose }: { cargaId: string; detalle: ReturnType<typeof descontarPendientes>; onClose: () => void }) {
  const qc = useQueryClient();
  const [id] = useState(() => crypto.randomUUID());
  const [producto, setProducto] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const d = detalle.find((x) => x.producto_id === producto);
  async function guardar() {
    if (!navigator.onLine) return toast.error("Registrar merma requiere conexión");
    if (!d || !validarMermaCamion(Number(cantidad), enCamion(d), motivo)) return toast.error("Seleccione el producto, una cantidad válida y justifique la merma");
    setBusy(true);
    try {
      const { error } = await supabase.rpc("registrar_merma_camion", { p: { id, carga_id: cargaId, producto_id: producto, cantidad: Number(cantidad), motivo: motivo.trim() } });
      if (error) throw error;
      await Promise.all(["cargas_camion", "dashboard", "reportes-gerenciales"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      toast.success("Merma registrada y descontada del camión");
      onClose();
    } catch (e) { toast.error(String((e as { message?: string }).message ?? "No se pudo registrar la merma")); }
    finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={(o) => !o && !busy && onClose()}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Registrar merma</DialogTitle><DialogDescription>Producto dañado o perdido</DialogDescription></DialogHeader>
    <div className="space-y-1"><Label htmlFor="merma-producto">Producto</Label><select id="merma-producto" disabled={busy} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={producto} onChange={(e) => setProducto(e.target.value)}><option value="">Seleccionar producto…</option>{detalle.filter((x) => enCamion(x) > 0).map((x) => <option key={x.id} value={x.producto_id}>{x.nombre_producto} · {enCamion(x)} a bordo</option>)}</select></div>
    <div className="space-y-1"><Label htmlFor="merma-cantidad">Unidades dañadas / perdidas</Label><Input id="merma-cantidad" disabled={busy} type="number" min={0} max={d ? enCamion(d) : 0} step="0.01" value={cantidad} onChange={(e) => setCantidad(e.target.value)} /></div>
    <div className="space-y-1"><Label htmlFor="merma-motivo">Justificación obligatoria</Label><Textarea id="merma-motivo" disabled={busy} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={2000} /></div>
    <Button disabled={busy} onClick={guardar}>{busy ? "Registrando…" : "Confirmar merma"}</Button>
  </DialogContent></Dialog>;
}