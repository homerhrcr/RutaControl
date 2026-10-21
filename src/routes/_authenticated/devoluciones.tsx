import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClientes, useRutas, useInvalidate, useProductos } from "@/lib/data";
import { useSolicitudesDevolucion, type SolicitudDevolucion } from "@/lib/solicitudes-devolucion";
import { MessageCircle } from "lucide-react";
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
import { queueDevolucion } from "@/lib/offline";
import { useAuth } from "@/lib/auth";
import { Plus, Undo2 } from "lucide-react";
import { DevolucionInspeccion, FotoDevolucion, type InspeccionProducto } from "@/components/DevolucionInspeccion";
import { TiqueteDevolucion } from "@/components/TiqueteDevolucion";
import type { DevolucionTiquete } from "@/lib/tiquete-devolucion";
import { ReceiptText } from "lucide-react";

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

import { OpcionSelect } from "@/components/OpcionSelect";
import { CatalogSelect } from "@/components/CatalogSelect";
import { useOpciones } from "@/lib/catalogos";
import { predeterminada } from "@/lib/catalogos-logica";

const MOTIVOS_BASE = ["Vencido", "Dañado / quebrado", "Mal estado", "No vendido", "Error de pedido"];
type Linea = LineaItem & InspeccionProducto & { motivo: string; destino: "reingreso" | "merma" };

function DevolucionesPage() {
  const [open, setOpen] = useState(false);
  const [tiquete, setTiquete] = useState<DevolucionTiquete | null>(null);
  const [solicitud, setSolicitud] = useState<SolicitudDevolucion | null>(null);
  const { data: pendientes } = useSolicitudesDevolucion();
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
        {(pendientes ?? []).length > 0 && (
          <Card className="space-y-2 border-warning/50 p-3">
            <p className="flex items-center gap-2 text-sm font-bold"><MessageCircle className="h-4 w-4 text-warning" />Solicitudes pendientes por Telegram ({pendientes!.length})</p>
            {pendientes!.map((s) => (
              <div key={s.id} className="flex items-start justify-between gap-2 rounded-md border p-2">
                <div className="min-w-0 text-sm">
                  <p className="truncate font-semibold">{s.cliente}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(s.fecha)}</p>
                  <ul className="text-xs">{s.items.map((i, k) => <li key={k}>{i.cantidad} × {i.nombre} <span className="text-muted-foreground">({i.motivo})</span></li>)}</ul>
                  {s.notas && <p className="text-xs text-muted-foreground">📝 {s.notas}</p>}
                </div>
                <Button size="sm" onClick={() => { setSolicitud(s); setOpen(true); }}>Recibir</Button>
              </div>
            ))}
          </Card>
        )}
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
            {d.notas && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{d.notas}</p>}
            {Array.from((d.notas ?? "").matchAll(/Foto: ([0-9a-f-]{36})/g)).map((m) => <FotoDevolucion key={m[1]} id={m[1]} nombre="producto devuelto" />)}
            <Button variant="outline" size="sm" onClick={() => setTiquete(d)}><ReceiptText className="mr-2 h-4 w-4" />Tiquete</Button>
          </Card>
        ))}
      </div>
      <NuevaDevolucion open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSolicitud(null); }} solicitud={solicitud} />
      <TiqueteDevolucion data={tiquete} onClose={() => setTiquete(null)} />
    </div>
  );
}

function motivoDe(m: string) {
  const t = m.toLowerCase();
  if (t.includes("venc")) return "Vencido";
  if (t.includes("dañ") || t.includes("quebr") || t.includes("empaque")) return "Dañado / quebrado";
  if (t.includes("estado") || t.includes("agri")) return "Mal estado";
  if (t.includes("error") || t.includes("pedido")) return "Error de pedido";
  return MOTIVOS_BASE.find((x) => x.toLowerCase() === t) ?? m;
}

export function NuevaDevolucion({ open, onOpenChange, clienteId, solicitud }: { open: boolean; onOpenChange: (v: boolean) => void; clienteId?: string; solicitud?: SolicitudDevolucion | null }) {
  const { data: clientes } = useClientes();
  const { data: rutas } = useRutas();
  const { data: motivos = [] } = useOpciones("motivo_devolucion");
  const { data: destinos = [] } = useOpciones("destino_devolucion");
  const { data: productos } = useProductos(true);
  const { user } = useAuth();
  const [devolucionId, setDevolucionId] = useState<string>(() => crypto.randomUUID());
  const invalidate = useInvalidate();
  const [cliente, setCliente] = useState(clienteId ?? "");
  const [ruta, setRuta] = useState("");
  const [items, setItems] = useState<Linea[]>([]);
  const [aplicar, setAplicar] = useState(false);
  const [notas, setNotas] = useState("");
  const [busy, setBusy] = useState(false);
  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);

  useEffect(() => {
    if (!open || !solicitud) return;
    const c = (clientes ?? []).find((x) => x.id === solicitud.cliente_id);
    setDevolucionId(solicitud.id);
    setCliente(solicitud.cliente_id);
    setRuta((c as any)?.ruta_id ?? "");
    setNotas(["Solicitud por Telegram", solicitud.notas].filter(Boolean).join(" — "));
    setItems(solicitud.items.flatMap((i) => {
      const p = (productos ?? []).find((x) => x.nombre.trim().toLowerCase() === i.nombre.toLowerCase());
      return p ? [{ producto_id: p.id, nombre: p.nombre, precio: Number(p.precio), cantidad: i.cantidad, motivo: motivoDe(i.motivo), destino: "merma" as const }] : [];
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, solicitud?.id, productos?.length, clientes?.length]);

  async function guardar() {
    if (!user) return toast.error("Inicie sesión para registrar la devolución");
    if (!items.length || items.some((i) => i.cantidad <= 0)) return toast.error("Agregue productos con cantidad");
    setBusy(true);
    const p = {
        id: devolucionId,
        cliente_id: cliente || null,
        ruta_id: ruta || null,
        tipo: cliente ? "cliente" : "ruta",
        aplicar_credito: aplicar && !!cliente,
        notas: [notas, ...items.filter((i) => i.descripcion || i.evidencia_id || i.recomendacion).map((i) => [
          `${i.nombre}: ${i.descripcion ?? ""}`,
          i.evidencia_id ? `Foto: ${i.evidencia_id}` : "",
          i.recomendacion ? `IA: ${i.recomendacion.destino} — ${i.recomendacion.razon}\n${i.recomendacion.observaciones}` : "",
          `Destino confirmado: ${i.destino}`,
        ].filter(Boolean).join("\n"))].filter(Boolean).join("\n\n"),
        items: items.map((i) => ({ producto_id: i.producto_id, nombre: i.nombre, cantidad: i.cantidad, precio: i.precio, motivo: i.motivo, destino: i.destino })),
      };
    if (!navigator.onLine) {
      await queueDevolucion(p, user?.id ?? "");
      setBusy(false);
      toast.info("Sin conexión: devolución guardada en el dispositivo");
      setItems([]); setNotas(""); setAplicar(false); setDevolucionId(crypto.randomUUID()); onOpenChange(false);
      return;
    }
    const { error } = await supabase.rpc("registrar_devolucion", { p });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Devolución registrada");
    invalidate(["devoluciones", "productos", "creditos", "creditos-pendientes", "solicitudes-devolucion"]);
    setItems([]); setNotas(""); setAplicar(false); setDevolucionId(crypto.randomUUID());
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
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={cliente} onChange={(e) => {
                setCliente(e.target.value);
                const c = (clientes ?? []).find((x) => x.id === e.target.value) as any;
                setRuta(c?.ruta_id ?? (c?.cliente_rutas?.length ? c.cliente_rutas[0].ruta_id : "") ?? "");
              }}>
                <option value="">Retorno de ruta (sin cliente)</option>
                {(clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <CatalogSelect
              catalogo="rutas"
              label="Ruta"
              placeholder="—"
              value={ruta || "__none__"}
              onChange={(v) => setRuta(v === "__none__" ? "" : v)}
              extraOptions={[{ value: "__none__", label: "—" }]}
            />
          </div>
          <ItemsEditor<Linea>
            permitirSinPrecio
            clienteId={cliente || undefined}
            rutaId={ruta || null}
            items={items}
            onChange={setItems}
            nuevo={(b) => ({ ...b, motivo: predeterminada(motivos) ?? "Mal estado", destino: (predeterminada(destinos) ?? "merma") as Linea["destino"] })}
            extra={(it, set) => (
              <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <OpcionSelect catalogo="motivo_devolucion" label="Motivo" ariaLabel={`Motivo de ${it.nombre}`} className="h-9 rounded-md border bg-background px-2 text-sm" value={it.motivo} onChange={(v) => set({ motivo: v })} />
                <OpcionSelect catalogo="destino_devolucion" label="Destino" ariaLabel={`Destino de ${it.nombre}`} className="h-9 rounded-md border bg-background px-2 text-sm" value={it.destino} onChange={(v) => set({ destino: v as Linea["destino"], recomendacion_aplicada: false })} />
              </div>
              <DevolucionInspeccion productoId={it.producto_id} nombre={it.nombre} devolucionId={devolucionId} value={it} onChange={set} />
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
