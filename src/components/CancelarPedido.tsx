import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidate } from "@/lib/data";
import { useOpciones } from "@/lib/catalogos";
import { OpcionSelect } from "@/components/OpcionSelect";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export function CancelarPedido({ pedido, onClose, usuarioId }: { pedido: any; onClose: () => void; usuarioId?: string }) {
  const invalidate = useInvalidate();
  const { data: opciones = [] } = useOpciones("motivo_cancelacion_pedido");
  const [motivo, setMotivo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [busy, setBusy] = useState(false);
  async function confirmar() {
    if (!motivo) return toast.error("Seleccione el motivo de la cancelación");
    if (!navigator.onLine) return toast.error("Se necesita conexión para cancelar un pedido");
    const etiqueta = opciones.find((o) => o.codigo === motivo)?.etiqueta ?? motivo;
    setBusy(true);
    try {
      const { data, error } = await supabase.from("pedidos").update({
        estado: "cancelado",
        motivo_cancelacion: detalle.trim() ? `${etiqueta} — ${detalle.trim()}` : etiqueta,
        cancelado_por: usuarioId ?? null,
        cancelado_en: new Date().toISOString(),
      }).eq("id", pedido.id).in("estado", ["borrador", "confirmado", "cargado"]).is("venta_id", null).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("El pedido ya fue entregado o cancelado; actualice la lista");
      invalidate(["pedidos", "pedidos-carga", "pedidos-carga-consolidado", "cargas_camion", "cargas_camion-pendientes", "dashboard"]);
      toast.success(pedido.carga_id ? "Pedido cancelado: productos disponibles para venta libre en el camión" : "Pedido cancelado");
      onClose();
    } catch (error: any) {
      toast.error(error.message ?? "No se pudo cancelar el pedido");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Cancelar pedido · {pedido.clientes?.nombre}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <OpcionSelect catalogo="motivo_cancelacion_pedido" label="Motivo de cancelación" vacio="Seleccionar motivo…" value={motivo} onChange={setMotivo} />
          <Textarea placeholder="Detalle adicional (opcional)" value={detalle} onChange={(e) => setDetalle(e.target.value)} />
          {pedido.carga_id && <p className="text-xs text-muted-foreground">El producto reservado quedará disponible para venta libre en este camión.</p>}
          <Button className="w-full" variant="destructive" disabled={busy || !motivo} onClick={confirmar}>{busy ? "Cancelando…" : "Confirmar cancelación"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}