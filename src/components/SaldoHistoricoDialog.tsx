import { useEffect, useState } from "react";
import { useClientes } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatCRC } from "@/lib/format";

const hoyCR = () => new Date(Date.now() - 6 * 3600_000).toISOString().slice(0, 10);

export function SaldoHistoricoDialog({
  open, onClose, onDone, rutaId, rutaNombre, clienteInicial,
}: {
  open: boolean; onClose: () => void; onDone: () => void;
  rutaId: string; rutaNombre: string; clienteInicial?: { id: string; nombre: string } | null;
}) {
  const valida = !!rutaId && rutaId !== "sin-ruta";
  const { data: clientes } = useClientes(valida ? rutaId : undefined);
  const [clienteId, setClienteId] = useState("");
  const [monto, setMonto] = useState(0);
  const [fecha, setFecha] = useState(hoyCR());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setClienteId(clienteInicial?.id ?? ""); setMonto(0); setFecha(hoyCR()); }
  }, [open, clienteInicial?.id]);

  async function guardar() {
    if (!clienteId) return toast.error("Selecciona el cliente");
    if (!Number.isFinite(monto) || monto <= 0) return toast.error("El monto debe ser mayor a cero");
    if (!fecha || fecha > hoyCR()) return toast.error("La fecha no puede ser futura");
    setBusy(true);
    try {
      const { error } = await supabase.from("creditos").insert({
        id: crypto.randomUUID(), cliente_id: clienteId, ruta_id: valida ? rutaId : null,
        venta_id: null, fecha: `${fecha}T12:00:00-06:00`, monto, saldo: monto, estado: "al_dia",
      });
      if (error) throw error;
      toast.success(`Saldo histórico registrado · ${formatCRC(monto)}`);
      onDone(); onClose();
    } catch (e: any) { toast.error(e.message ?? "No se pudo registrar el saldo"); }
    finally { setBusy(false); }
  }

  const lista = clientes ?? [];
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Registrar saldo histórico</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Deuda anterior (fichas de papel) de {rutaNombre}. No afecta inventario.</p>
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger className="h-11"><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
              <SelectContent>
                {clienteInicial && !lista.some((c: any) => c.id === clienteInicial.id) && <SelectItem value={clienteInicial.id}>{clienteInicial.nombre}</SelectItem>}
                {lista.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sh-monto">Monto adeudado</Label>
            <Input id="sh-monto" type="number" inputMode="numeric" className="h-11" placeholder="₡0" value={monto || ""} onChange={(e) => setMonto(Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sh-fecha">Fecha de la deuda</Label>
            <Input id="sh-fecha" type="date" className="h-11" max={hoyCR()} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <Button className="h-12 w-full" disabled={busy} onClick={guardar}>Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
