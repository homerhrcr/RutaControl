import { registrarAbono } from "@/lib/data";
import { queueAbono } from "@/lib/offline";
import { distribuirAbono } from "@/lib/abono-distribucion";
import { formatCRC } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HandCoins } from "lucide-react";

type Credito = { id: string; saldo: number | string };

/** Bloque para abonar a deudas pendientes del cliente durante la misma visita. */
export function AbonoEnVenta({ creditos, monto, onMonto }: { creditos: Credito[]; monto: number; onMonto: (n: number) => void }) {
  const saldo = creditos.reduce((s, c) => s + Number(c.saldo), 0);
  if (saldo <= 0) return null;
  return (
    <div className="space-y-2 rounded-lg border border-warning/50 bg-warning/10 p-3">
      <p className="flex items-center gap-2 text-sm font-semibold"><HandCoins className="h-4 w-4" />Deuda pendiente en esta ruta: {formatCRC(saldo)}</p>
      <p className="text-xs text-muted-foreground">¿Registrar un abono en esta visita? Se aplica a la deuda más antigua primero.</p>
      <div className="flex gap-2">
        <Input type="number" inputMode="numeric" min={0} placeholder="₡0" value={monto || ""} className="h-10"
          onChange={(e) => onMonto(Math.min(saldo, Math.max(0, Number(e.target.value) || 0)))} />
        <Button type="button" variant="secondary" onClick={() => onMonto(saldo)}>Abonar todo</Button>
      </div>
    </div>
  );
}

/** Registra el abono de la visita (en línea o en la cola sin conexión). Devuelve lo aplicado, el saldo que queda y los ids. */
export async function registrarAbonosVisita(p: {
  creditos: Credito[]; monto: number; cliente_id: string; cobrador_id: string; medio_pago?: string | null; referencia_pago?: string | null;
}) {
  const { partes, aplicado } = distribuirAbono(p.creditos, p.monto);
  const ids: string[] = [];
  let offline = false;
  for (const { credito, monto } of partes) {
    const params = { id: crypto.randomUUID(), credito_id: credito.id, cliente_id: p.cliente_id, monto, cobrador_id: p.cobrador_id, saldoActual: Number(credito.saldo), medio_pago: p.medio_pago, referencia_pago: p.referencia_pago };
    ids.push(params.id);
    if (!navigator.onLine) { await queueAbono(params); offline = true; continue; }
    try { await registrarAbono(params); } catch { await queueAbono(params); offline = true; }
  }
  const saldo = p.creditos.reduce((s, c) => s + Number(c.saldo), 0) - aplicado;
  return { aplicado, saldo, ids, offline };
}
