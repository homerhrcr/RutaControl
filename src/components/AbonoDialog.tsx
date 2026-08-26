import { useEffect, useState } from "react";
import { useCreditosCliente, registrarAbono } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { formatCRC, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { HandCoins } from "lucide-react";

export function AbonoDialog({
  cliente,
  open,
  onClose,
  onDone,
}: {
  cliente: { id: string; nombre: string } | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const { data: creditos, refetch } = useCreditosCliente(cliente?.id);
  const [monto, setMonto] = useState<number>(0);
  const [destino, setDestino] = useState<string>("todos");
  const [busy, setBusy] = useState(false);

  const saldoTotal = (creditos ?? []).reduce((s, c) => s + Number(c.saldo), 0);

  useEffect(() => {
    if (open) {
      setMonto(0);
      setDestino("todos");
    }
  }, [open]);

  async function abonar(montoAbono: number, forzarTodos = false) {
    if (!cliente || !user) return;
    if (montoAbono <= 0) return toast.error("Ingresa un monto");
    setBusy(true);
    try {
      let restante = montoAbono;
      // Si se eligió un día específico, aplicar solo a ese crédito.
      // De lo contrario, aplicar a los créditos más antiguos primero.
      // forzarTodos se usa en "Pagar todo" para ignorar la selección actual.
      const destinoEfectivo = forzarTodos ? "todos" : destino;
      const lista =
        destinoEfectivo === "todos"
          ? (creditos ?? [])
          : (creditos ?? []).filter((c) => c.id === destinoEfectivo);
      for (const c of lista) {
        if (restante <= 0) break;
        const aplicar = Math.min(restante, Number(c.saldo));
        await registrarAbono({
          credito_id: c.id,
          cliente_id: cliente.id,
          monto: aplicar,
          cobrador_id: user.id,
          saldoActual: Number(c.saldo),
        });
        restante -= aplicar;
      }
      const aplicado = montoAbono - restante;
      toast.success(`Abono registrado · ${formatCRC(aplicado)}`);
      await refetch();
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Error al registrar abono");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandCoins className="h-5 w-5 text-accent" /> Registrar abono
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl bg-muted p-4 text-center">
            <p className="text-sm text-muted-foreground">{cliente?.nombre}</p>
            <p className="text-3xl font-black text-destructive">{formatCRC(saldoTotal)}</p>
            <p className="text-xs text-muted-foreground">Saldo pendiente</p>
          </div>

          {(creditos ?? []).length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Aplicar abono a</Label>
              <Select value={destino} onValueChange={setDestino}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Más antiguo primero (todos)</SelectItem>
                  {creditos!.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      Día {formatDate(c.fecha)} · {formatCRC(c.saldo)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Input
            type="number"
            inputMode="numeric"
            className="h-14 text-center text-2xl font-bold"
            placeholder="₡0"
            value={monto || ""}
            onChange={(e) => setMonto(Number(e.target.value) || 0)}
          />

          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" className="h-12" disabled={busy} onClick={() => abonar(monto)}>
              Abonar
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="h-12"
              disabled={busy}
              onClick={() => {
                setDestino("todos");
                abonar(saldoTotal, true);
              }}
            >
              Pagar todo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
