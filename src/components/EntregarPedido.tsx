import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidate, registrarVenta } from "@/lib/data";
import { useCargasCamion, usePendientesCamion, descontarPendientes } from "@/lib/carga-camion";
import { validarVentaCamion } from "@/lib/carga-camion-calculos";
import { ItemsEditor, type LineaItem } from "@/components/ItemsEditor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCRC } from "@/lib/format";
import { toast } from "sonner";
import { queueEntrega } from "@/lib/offline";
import { Tiquete, type TiqueteData } from "@/components/Tiquete";

export const PEDIDO_ENTREGA_SELECT = "*, clientes(nombre), rutas(nombre), pedidos_detalle(*)";

export function EntregarPedido({ pedido, onClose, vendedorId }: { pedido: any; onClose: () => void; vendedorId: string }) {
  const { data: cargas } = useCargasCamion();
  const { data: pendientes = [] } = usePendientesCamion();
  const invalidate = useInvalidate();
  const [items, setItems] = useState<LineaItem[]>(
    pedido.pedidos_detalle.map((l: any) => ({ producto_id: l.producto_id, nombre: l.nombre_producto, precio: Number(l.precio_unitario), cantidad: Number(l.cantidad) })),
  );
  const [metodo, setMetodo] = useState<"contado" | "credito">("contado");
  const [busy, setBusy] = useState(false);
  const [tiquete, setTiquete] = useState<TiqueteData | null>(null);
  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);

  async function confirmar() {
    const entregados = items.filter((i) => i.cantidad > 0);
    if (!entregados.length) return toast.error("No hay productos entregados");
    // Si el pedido no quedó ligado a una carga, se usa el camión activo de su ruta.
    const carga = pedido.carga_id
      ? cargas?.find((c) => c.id === pedido.carga_id)
      : cargas?.find((c) => c.estado === "en_ruta" && c.ruta_id === pedido.ruta_id);
    const cargaId = carga?.id ?? pedido.carga_id ?? null;
    if (cargaId && (!carga || !validarVentaCamion(descontarPendientes(carga, pendientes, pedido.id), entregados))) return toast.error("Revise las existencias disponibles del camión");
    setBusy(true);
    const ventaP = { id: pedido.venta_id ?? pedido.id, carga_id: cargaId, cliente_id: pedido.cliente_id, ruta_id: pedido.ruta_id, vendedor_id: vendedorId, items: entregados, descuento: 0, metodo };
    if (!navigator.onLine) {
      await queueEntrega(pedido.id, ventaP);
      setBusy(false);
      toast.info("Sin conexión: la entrega se facturará al reconectar");
      return onClose();
    }
    try {
      // El id de la venta es estable por pedido: si se reintenta, no se duplica.
      const venta = await registrarVenta({
        id: pedido.venta_id ?? pedido.id,
        carga_id: cargaId,
        cliente_id: pedido.cliente_id,
        ruta_id: pedido.ruta_id,
        vendedor_id: vendedorId,
        items: entregados,
        descuento: 0,
        metodo,
      });
      const { error } = await supabase.from("pedidos").update({ estado: "entregado", venta_id: venta.id }).eq("id", pedido.id);
      if (error) throw error;
      toast.success("Pedido entregado y facturado");
      invalidate(["pedidos", "ventas", "productos", "creditos", "creditos-pendientes", "cargas_camion", "ventas-camion"]);
      setTiquete({
        venta_id: venta.id,
        cliente_id: pedido.cliente_id,
        cliente_nombre: pedido.clientes?.nombre ?? "Cliente",
        fecha: venta.fecha ?? new Date().toISOString(),
        items: entregados,
        subtotal: total,
        descuento: 0,
        total: Number(venta.total),
        metodo,
      });
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo entregar");
    } finally {
      setBusy(false);
    }
  }

  if (tiquete) return <Tiquete data={tiquete} open onClose={onClose} />;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>Entregar a {pedido.clientes?.nombre}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Ajuste las cantidades si se entregó menos o más de lo pedido.</p>
          <ItemsEditor clienteId={pedido.cliente_id} rutaId={pedido.ruta_id} items={items} onChange={setItems} nuevo={(b) => b} />
          <div className="grid grid-cols-2 gap-2">
            <Button variant={metodo === "contado" ? "default" : "outline"} onClick={() => setMetodo("contado")}>Contado</Button>
            <Button variant={metodo === "credito" ? "default" : "outline"} onClick={() => setMetodo("credito")}>Crédito</Button>
          </div>
          <Button className="w-full" size="lg" disabled={busy} onClick={confirmar}>{busy ? "Procesando…" : `Confirmar venta · ${formatCRC(total)}`}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
