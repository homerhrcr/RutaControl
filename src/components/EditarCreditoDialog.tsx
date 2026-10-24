import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export type CreditoEditable = { id: string; monto: number; fecha: string; fecha_limite: string | null; venta_id: string | null };

export function EditarCreditoDialog({ credito, modo, onClose, onDone }: {
  credito: CreditoEditable | null; modo: "editar" | "borrar"; onClose: () => void; onDone: () => void;
}) {
  const [monto, setMonto] = useState(0);
  const [fecha, setFecha] = useState("");
  const [limite, setLimite] = useState("");
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const historico = !credito?.venta_id;

  useEffect(() => {
    if (!credito) return;
    setMonto(Number(credito.monto)); setFecha(credito.fecha.slice(0, 10));
    setLimite(credito.fecha_limite ?? ""); setMotivo("");
  }, [credito]);

  async function guardar() {
    if (!credito) return;
    if (!motivo.trim()) return toast.error("Indica el motivo");
    setBusy(true);
    try {
      const { error } = modo === "borrar"
        ? await supabase.rpc("admin_eliminar_credito", { p_id: credito.id, p_motivo: motivo.trim() })
        : await supabase.rpc("admin_editar_credito", {
            p_id: credito.id, p_monto: monto, p_fecha: fecha, p_fecha_limite: (limite || null) as any, p_motivo: motivo.trim(),
          });
      if (error) throw error;
      toast.success(modo === "borrar" ? "Crédito borrado" : "Crédito actualizado");
      onDone(); onClose();
    } catch (e: any) { toast.error(e.message ?? "No se pudo guardar"); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={!!credito} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{modo === "borrar" ? "Borrar crédito" : "Editar crédito"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {modo === "borrar" ? (
            <p className="text-sm text-muted-foreground">Solo se pueden borrar saldos históricos sin abonos. Los créditos de una venta se eliminan anulando la venta.</p>
          ) : (<>
            {!historico && <p className="text-xs text-muted-foreground">Este crédito viene de una venta: solo se puede cambiar la fecha límite.</p>}
            {historico && <>
              <div className="space-y-1.5"><Label htmlFor="ec-monto">Monto adeudado</Label>
                <Input id="ec-monto" type="number" inputMode="numeric" className="h-11" value={monto || ""} onChange={(e) => setMonto(Number(e.target.value) || 0)} /></div>
              <div className="space-y-1.5"><Label htmlFor="ec-fecha">Fecha de la deuda</Label>
                <Input id="ec-fecha" type="date" className="h-11" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
            </>}
            <div className="space-y-1.5"><Label htmlFor="ec-limite">Fecha límite (opcional)</Label>
              <Input id="ec-limite" type="date" className="h-11" value={limite} onChange={(e) => setLimite(e.target.value)} /></div>
          </>)}
          <div className="space-y-1.5"><Label htmlFor="ec-motivo">Motivo</Label>
            <Input id="ec-motivo" className="h-11" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: monto mal digitado" /></div>
          <Button className="h-12 w-full" variant={modo === "borrar" ? "destructive" : "default"} disabled={busy} onClick={guardar}>
            {modo === "borrar" ? "Borrar" : "Guardar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
