import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClientes, useRutas, useInvalidate } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { ItemsEditor, type LineaItem } from "@/components/ItemsEditor";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCRC, formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Undo2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/devoluciones")({
  head: () => ({
    meta: [
      { title: "Devoluciones y merma — Ruta Directo" },
      { name: "description", content: "Registro de producto devuelto, dañado o vencido en ruta." },
      { property: "og:title", content: "Devoluciones y merma — Ruta Directo" },
      { property: "og:description", content: "Registro de producto devuelto, dañado o vencido en ruta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DevolucionesPage,
});

const MOTIVOS = ["Vencido", "Dañado / quebrado", "Mal estado", "No vendido", "Error de pedido"];
type Linea = LineaItem & { motivo: string; destino: "reingreso" | "merma" };

function DevolucionesPage() {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["devoluciones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("devoluciones")
        .select("*, clientes(nombre), rutas(nombre), devoluciones_detalle(*)")
        .order("fecha", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
  const merma = (data ?? []).flatMap((d) => d.devoluciones_detalle).filter((l) => l.destino === "merma");
  const reingreso = (data ?? []).flatMap((d) => d.devoluciones_detalle).filter((l) => l.destino === "reingreso");
  const valor = (ls: typeof merma) => ls.reduce((s, l) => s + Number(l.cantidad) * Number(l.precio_unitario), 0);

  return (
    <div>
      <PageHeader title="Devoluciones" subtitle="Producto que regresa de la ruta" action={<Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Nueva</Button>} />
      <div className="space-y-4 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3"><p className="text-xs text-muted-foreground">Merma (dañado/vencido)</p><p className="text-lg font-black text-destructive">{formatCRC(valor(merma))}</p></Card>
          <Card className="p-3"><p className="text-xs text-muted-foreground">Regresó a bodega</p><p className="text-lg font-black">{formatCRC(valor(reingreso))}</p></Card>
        </div>
        {(data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Aún no hay devoluciones.</p>}
        {(data ?? []).map((d) => (
          <Card key={d.id} className="space-y-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{d.clientes?.nombre ?? (d.tipo === "ruta" ? "Retorno de ruta" : "Sin cliente")}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(d.fecha)}{d.rutas?.nombre ? ` · ${d.rutas.nombre}` : ""}</p>
              </div>
              <div className="text-right">
                <p className="font-bold">{formatCRC(Number(d.total))}</p>
                {Number(d.aplicado_credito) > 0 && <p className="text-xs text-success">Rebajado de deuda {formatCRC(Number(d.aplicado_credito))}</p>}
              </div>
            </div>
            <ul className="space-y-1 text-sm">
              {d.devoluciones_detalle.map((l) => (
                <li key={l.id} className="flex justify-between gap-2">
                  <span className="truncate">{Number(l.cantidad)} × {l.nombre_producto} <span className="text-muted-foreground">({l.motivo})</span></span>
                  <span className={l.destino === "merma" ? "text-destructive" : "text-muted-foreground"}>{l.destino === "merma" ? "Merma" : "A bodega"}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
      <NuevaDevolucion open={open} onOpenChange={setOpen} />
    </div>
  );
}

export function NuevaDevolucion({ open, onOpenChange, clienteId }: { open: boolean; onOpenChange: (v: boolean) => void; clienteId?: string }) {
  const { data: clientes } = useClientes();
  const { data: rutas } = useRutas();
  const invalidate = useInvalidate();
  const [cliente, setCliente] = useState(clienteId ?? "");
  const [ruta, setRuta] = useState("");
  const [items, setItems] = useState<Linea[]>([]);
  const [aplicar, setAplicar] = useState(false);
  const [notas, setNotas] = useState("");
  const [busy, setBusy] = useState(false);
  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);

  async function guardar() {
    if (!items.length || items.some((i) => i.cantidad <= 0)) return toast.error("Agregue productos con cantidad");
    setBusy(true);
    const { error } = await supabase.rpc("registrar_devolucion", {
      p: {
        id: crypto.randomUUID(),
        cliente_id: cliente || null,
        ruta_id: ruta || null,
        tipo: cliente ? "cliente" : "ruta",
        aplicar_credito: aplicar && !!cliente,
        notas,
        items: items.map((i) => ({ producto_id: i.producto_id, nombre: i.nombre, cantidad: i.cantidad, precio: i.precio, motivo: i.motivo, destino: i.destino })),
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Devolución registrada");
    invalidate(["devoluciones", "productos", "creditos", "creditos-pendientes"]);
    setItems([]); setNotas(""); setAplicar(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Undo2 className="h-5 w-5" />Registrar devolución</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Cliente</Label>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={cliente} onChange={(e) => setCliente(e.target.value)}>
                <option value="">Retorno de ruta (sin cliente)</option>
                {(clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ruta</Label>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={ruta} onChange={(e) => setRuta(e.target.value)}>
                <option value="">—</option>
                {(rutas ?? []).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
          </div>
          <ItemsEditor<Linea>
            items={items}
            onChange={setItems}
            nuevo={(b) => ({ ...b, motivo: MOTIVOS[0], destino: "merma" })}
            extra={(it, set) => (
              <div className="grid grid-cols-2 gap-2">
                <select className="h-9 rounded-md border bg-background px-2 text-sm" value={it.motivo} onChange={(e) => set({ motivo: e.target.value })}>
                  {MOTIVOS.map((m) => <option key={m}>{m}</option>)}
                </select>
                <select className="h-9 rounded-md border bg-background px-2 text-sm" value={it.destino} onChange={(e) => set({ destino: e.target.value as Linea["destino"] })}>
                  <option value="merma">Merma (se desecha)</option>
                  <option value="reingreso">Regresa a bodega</option>
                </select>
              </div>
            )}
          />
          {cliente && (
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>Rebajar {formatCRC(total)} de la deuda del cliente</Label>
              <Switch checked={aplicar} onCheckedChange={setAplicar} />
            </div>
          )}
          <Textarea placeholder="Notas" value={notas} onChange={(e) => setNotas(e.target.value)} />
          <Button className="w-full" size="lg" disabled={busy} onClick={guardar}>{busy ? "Guardando…" : `Registrar · ${formatCRC(total)}`}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
