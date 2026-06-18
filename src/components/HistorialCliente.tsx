import { useMemo, useState } from "react";
import { useVentasCliente } from "@/lib/data";
import { formatCRC } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Banknote, CreditCard } from "lucide-react";

export function HistorialCliente({
  cliente,
  open,
  onClose,
}: {
  cliente: { id: string; nombre: string } | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data: ventas, isLoading } = useVentasCliente(cliente?.id, 100);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const filtered = useMemo(() => {
    return (ventas ?? []).filter((v) => {
      const f = (v.fecha ?? "").slice(0, 10);
      if (desde && f < desde) return false;
      if (hasta && f > hasta) return false;
      return true;
    });
  }, [ventas, desde, hasta]);

  const totalPeriodo = filtered.reduce((s, v) => s + Number(v.total ?? 0), 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[100dvh] max-w-lg flex-col gap-0 p-0 sm:h-[88vh]">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="text-base">Historial de compras</DialogTitle>
          <p className="truncate text-xs text-muted-foreground">{cliente?.nombre}</p>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 border-b p-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Desde</label>
            <Input type="date" className="h-9" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Hasta</label>
            <Input type="date" className="h-9" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {isLoading && <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>}
          {!isLoading && filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">Sin compras en este periodo.</p>
          )}
          <div className="space-y-3">
            {filtered.map((v) => (
              <div key={v.id} className="rounded-xl border bg-card p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {new Date(v.fecha ?? "").toLocaleDateString("es-CR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <Badge variant={v.metodo_pago === "credito" ? "outline" : "secondary"} className="gap-1 text-[10px]">
                    {v.metodo_pago === "credito" ? (
                      <CreditCard className="h-3 w-3" />
                    ) : (
                      <Banknote className="h-3 w-3" />
                    )}
                    {v.metodo_pago}
                  </Badge>
                </div>
                <div className="space-y-1">
                  {(v.detalle_ventas ?? []).map((d: any) => (
                    <div key={d.id} className="flex items-start justify-between gap-2 text-sm">
                      <span className="flex-1">
                        <span className="font-medium">{Number(d.cantidad)}×</span> {d.nombre_producto}
                      </span>
                      <span>{formatCRC(Number(d.total_linea))}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between border-t pt-2">
                  {Number(v.descuento) > 0 ? (
                    <span className="text-xs text-muted-foreground">Desc. {formatCRC(Number(v.descuento))}</span>
                  ) : (
                    <span />
                  )}
                  <span className="font-black">{formatCRC(Number(v.total))}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t bg-card p-3">
          <span className="text-sm text-muted-foreground">{filtered.length} compra(s)</span>
          <span className="text-lg font-black">{formatCRC(totalPeriodo)}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
