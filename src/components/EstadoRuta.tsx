import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Flag, RotateCcw } from "lucide-react";

type Carga = { id: string; estado: string; rutas?: { nombre: string } | null };

async function refrescar(qc: ReturnType<typeof useQueryClient>) {
  await Promise.all(["cargas_camion", "pedidos"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
}

/** Insignia anaranjada parpadeante para cargas que esperan la liquidación del camión. */
export function PendienteLiquidacionBadge({ className = "" }: { className?: string }) {
  return <span className={`inline-flex animate-pulse items-center rounded-full bg-warning px-2.5 py-0.5 text-xs font-bold text-warning-foreground ${className}`}>Pendiente de liquidación</span>;
}

export function FinalizarRutaButton({ carga, disabled }: { carga: Carga; disabled?: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  async function confirmar() {
    setBusy(true);
    const { error } = await supabase.rpc("finalizar_ruta_carga", { p_carga: carga.id, p_nota: nota });
    setBusy(false);
    if (error) return toast.error(error.message);
    await refrescar(qc);
    setOpen(false); setNota("");
    toast.success("Ruta finalizada · Queda pendiente de liquidación");
  }
  return <>
    <Button variant="destructive" disabled={disabled} onClick={() => setOpen(true)}><Flag className="mr-2 h-4 w-4" />Finalizar ruta</Button>
    <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Finalizar {carga.rutas?.nombre ?? "ruta"}</DialogTitle>
          <DialogDescription>Ya no se podrán hacer ventas ni entregas con este camión. La ruta quedará pendiente de liquidación hasta que se entregue el camión.</DialogDescription></DialogHeader>
        <div className="space-y-2"><Label htmlFor="nota-fin">Nota u observación (opcional)</Label>
          <Textarea id="nota-fin" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: Camión guardado en plantel, 2 cajas dañadas" /></div>
        <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button><Button variant="destructive" disabled={busy} onClick={confirmar}>Finalizar ruta</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}

export function ReabrirRutaButton({ carga, disabled }: { carga: Carga; disabled?: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  async function confirmar() {
    if (!motivo.trim()) return toast.error("Indique el motivo de la reapertura");
    setBusy(true);
    const { error } = await supabase.rpc("reabrir_ruta_carga", { p_carga: carga.id, p_motivo: motivo });
    setBusy(false);
    if (error) return toast.error(error.message);
    await refrescar(qc);
    setOpen(false); setMotivo("");
    toast.success("Ruta reabierta · Registrado en auditoría");
  }
  return <>
    <Button variant="outline" disabled={disabled} onClick={() => setOpen(true)}><RotateCcw className="mr-2 h-4 w-4" />Reabrir ruta</Button>
    <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Reabrir {carga.rutas?.nombre ?? "ruta"}</DialogTitle>
          <DialogDescription>El vendedor podrá volver a vender y entregar. El motivo queda registrado en la auditoría.</DialogDescription></DialogHeader>
        <div className="space-y-2"><Label htmlFor="motivo-reab">Motivo de la reapertura (obligatorio)</Label>
          <Textarea id="motivo-reab" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: El vendedor finalizó por error, faltaban 3 clientes" /></div>
        <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={busy || !motivo.trim()} onClick={confirmar}>Reabrir ruta</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}
