import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCRC } from "@/lib/format";
import { aplicarPrecioManual, type LineaPrecioManual } from "@/lib/precios";
import { toast } from "sonner";

/** Cambia el precio de una sola línea para esta venta/pedido, con motivo obligatorio. */
export function EditarPrecioDialog<T extends LineaPrecioManual & { nombre: string }>({
  linea,
  onClose,
  onGuardar,
}: {
  linea: T | null;
  onClose: () => void;
  onGuardar: (l: T) => void;
}) {
  const [precio, setPrecio] = useState("");
  const [motivo, setMotivo] = useState("");
  useEffect(() => {
    if (linea) { setPrecio(String(linea.precio)); setMotivo(linea.motivoModificacion ?? ""); }
  }, [linea]);

  return (
    <Dialog open={!!linea} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Cambiar precio solo para esta venta</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm">
            {linea?.nombre} · precio de lista {formatCRC(linea?.precioOriginal ?? linea?.precio ?? 0)}
          </p>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Precio unitario nuevo</label>
            <Input type="number" min={0} step="0.01" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Motivo del cambio</label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: acuerdo con el cliente" />
          </div>
          <p className="text-xs text-muted-foreground">La lista de precios no cambia. Queda registrado quién lo cambió y por qué.</p>
          <Button
            className="w-full"
            onClick={() => {
              if (!linea) return;
              try {
                onGuardar(aplicarPrecioManual(linea, Number(precio.replace(",", ".")), motivo));
                onClose();
                toast.success("Precio cambiado solo para esta venta");
              } catch (e: any) {
                toast.error(e?.message ?? "No se pudo cambiar el precio");
              }
            }}
          >
            Confirmar precio
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
