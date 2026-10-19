import { createFileRoute, Link } from "@tanstack/react-router";
import { useCargasCamion, usePendientesCamion, descontarPendientes } from "@/lib/carga-camion";
import { validarVentaCamion } from "@/lib/carga-camion-calculos";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClientes, useRutas, useInvalidate, registrarVenta } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { ItemsEditor, type LineaItem } from "@/components/ItemsEditor";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCRC } from "@/lib/format";
import { toast } from "sonner";
import { queuePedido, queuePedidoEstado, queueEntrega } from "@/lib/offline";
import { Plus, Truck, CheckCircle2, XCircle } from "lucide-react";
import { TelegramEnviar, PedidoTelegram } from "@/components/TelegramCliente";
import { notificarDocumentoTelegram } from "@/lib/telegram-notificar";
import { fechaLegible } from "@/lib/telegram";

export const Route = createFileRoute("/_authenticated/pedidos")({
  head: () => ({
    meta: [
      { title: "Preventa y pedidos — Ruta Directo" },
      { name: "description", content: "Toma de pedidos previos, carga del camión y entrega en ruta." },
      { property: "og:title", content: "Preventa y pedidos — Ruta Directo" },
      { property: "og:description", content: "Toma de pedidos previos, carga del camión y entrega en ruta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PedidosPage,
});

const ESTADOS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  borrador: { label: "Borrador", variant: "outline" },
  confirmado: { label: "Confirmado", variant: "secondary" },
  cargado: { label: "Cargado", variant: "default" },
  entregado: { label: "Entregado", variant: "outline" },
  anulado: { label: "Anulado", variant: "destructive" },
};

function hoy(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function PedidosPage() {
  const { user } = useAuth();
  const { data: rutas } = useRutas();
  const invalidate = useInvalidate();
  const [fecha, setFecha] = useState("");
  const [ruta, setRuta] = useState("all");
  const [nuevo, setNuevo] = useState(false);
  const [entregar, setEntregar] = useState<any>(null);

  const { data: pedidos } = useQuery({
    queryKey: ["pedidos", fecha, ruta],
    queryFn: async () => {
      let q = supabase.from("pedidos").select("*, clientes(nombre), rutas(nombre), pedidos_detalle(*)").order("fecha_entrega").order("created_at");
      if (fecha) q = q.eq("fecha_entrega", fecha);
      if (ruta !== "all") q = q.eq("ruta_id", ruta);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  // El consolidado del camión ignora el filtro de fecha: la ruta puede tardar varios días.
  const { data: pedidosCarga } = useQuery({
    queryKey: ["pedidos-carga-consolidado", ruta],
    queryFn: async () => {
      let q = supabase.from("pedidos").select("*, pedidos_detalle(*)").in("estado", ["confirmado", "cargado"]);
      if (ruta !== "all") q = q.or(`ruta_id.eq.${ruta},ruta_id.is.null`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const carga = useMemo(() => {
    const m = new Map<string, { nombre: string; cantidad: number }>();
    for (const p of pedidosCarga ?? []) {
      for (const l of p.pedidos_detalle) {
        const x = m.get(l.producto_id) ?? { nombre: l.nombre_producto, cantidad: 0 };
        x.cantidad += Number(l.cantidad);
        m.set(l.producto_id, x);
      }
    }
    return [...m.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [pedidosCarga]);

  async function cambiarEstado(id: string, estado: string) {
    if (!navigator.onLine) { await queuePedidoEstado([id], estado, user?.id ?? ""); return toast.info("Sin conexión: se actualizará al reconectar"); }
    const { error } = await supabase.from("pedidos").update({ estado }).eq("id", id);
    if (error) return toast.error(error.message);
    if (estado === "confirmado") await notificarDocumentoTelegram("pedido", id);
    invalidate(["pedidos", "pedidos-carga-consolidado"]);
  }

  return (
    <div>
      <PageHeader title="Preventa" subtitle="Pedidos previos a la entrega" action={<Button onClick={() => setNuevo(true)}><Plus className="mr-1 h-4 w-4" />Pedido</Button>} />
      <div className="space-y-4 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label className="text-xs">Fecha de entrega (vacío = todas)</Label><div className="flex gap-1"><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />{fecha && <Button variant="ghost" size="sm" className="h-10" onClick={() => setFecha("")}>Todas</Button>}</div></div>
          <div className="space-y-1">
            <Label className="text-xs">Ruta</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={ruta} onChange={(e) => setRuta(e.target.value)}>
              <option value="all">Todas</option>
              {(rutas ?? []).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
        </div>
        <Tabs defaultValue="pedidos">
          <TabsList>
            <TabsTrigger value="pedidos">Pedidos ({pedidos?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="carga">Carga del camión</TabsTrigger>
          </TabsList>
          <TabsContent value="pedidos" className="space-y-3">
            {(pedidos ?? []).length === 0 && <p className="text-sm text-muted-foreground">No hay pedidos para esta fecha.</p>}
            {(pedidos ?? []).map((p) => (
              <Card key={p.id} className="space-y-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.clientes?.nombre}</p>
                    <p className="text-xs text-muted-foreground">{p.rutas?.nombre ?? "Sin ruta"}</p>
                    <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">📅 Entrega: {fechaLegible(p.fecha_entrega)}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={ESTADOS[p.estado].variant}>{ESTADOS[p.estado].label}</Badge>
                    <p className="font-bold">{formatCRC(Number(p.total))}</p>
                  </div>
                </div>
                <ul className="text-sm text-muted-foreground">
                  {p.pedidos_detalle.map((l) => <li key={l.id}>{Number(l.cantidad)} × {l.nombre_producto}</li>)}
                </ul>
                {p.notas && <p className="text-xs italic">{p.notas}</p>}
                {["confirmado", "cargado", "entregado"].includes(p.estado) && <PedidoTelegram pedidoId={p.id} clienteId={p.cliente_id} nombre={p.clientes?.nombre} rutaId={p.ruta_id} fechaEntrega={p.fecha_entrega} rutas={rutas ?? []} />}
                {p.estado === "entregado" && p.venta_id && <TelegramEnviar tipo="tiquete" documentoId={p.venta_id} />}
                {p.estado !== "entregado" && p.estado !== "anulado" && (
                  <div className="flex flex-wrap gap-2">
                    {p.estado === "borrador" && <Button size="sm" variant="secondary" onClick={() => cambiarEstado(p.id, "confirmado")}>Confirmar</Button>}
                    <Button size="sm" onClick={() => setEntregar(p)}><CheckCircle2 className="mr-1 h-4 w-4" />Entregar y facturar</Button>
                    <Button size="sm" variant="ghost" disabled={!!p.carga_id} onClick={() => cambiarEstado(p.id, "anulado")}><XCircle className="mr-1 h-4 w-4" />Anular</Button>
                  </div>
                )}
              </Card>
            ))}
          </TabsContent>
          <TabsContent value="carga">
            <p className="mb-2 text-xs text-muted-foreground">Consolida todos los pedidos confirmados y cargados de la ruta, sin importar la fecha de entrega.</p>
            <Card className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="px-4 py-2">Producto</th><th className="px-4 py-2 text-right">Cargar</th></tr></thead>
                <tbody>
                  {carga.map((c) => <tr key={c.nombre} className="border-b border-border/50"><td className="px-4 py-2">{c.nombre}</td><td className="px-4 py-2 text-right font-bold">{c.cantidad}</td></tr>)}
                  {!carga.length && <tr><td colSpan={2} className="px-4 py-6 text-center text-muted-foreground">Sin pedidos confirmados</td></tr>}
                </tbody>
              </table>
            </Card>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" onClick={() => window.print()}>Imprimir</Button>
              <Button asChild><Link to="/carga-camion"><Truck className="mr-1 h-4 w-4" />Carga de Camión</Link></Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <NuevoPedido open={nuevo} onOpenChange={setNuevo} fecha={fecha || hoy(1)} usuarioId={user?.id} />
      {entregar && <EntregarPedido pedido={entregar} onClose={() => setEntregar(null)} vendedorId={user?.id ?? ""} />}
    </div>
  );
}

function NuevoPedido({ open, onOpenChange, fecha, usuarioId }: { open: boolean; onOpenChange: (v: boolean) => void; fecha: string; usuarioId?: string }) {
  const { data: clientes } = useClientes();
  const invalidate = useInvalidate();
  const [cliente, setCliente] = useState("");
  const [f, setF] = useState(fecha);
  const [items, setItems] = useState<LineaItem[]>([]);
  const [notas, setNotas] = useState("");
  const [busy, setBusy] = useState(false);
  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);

  async function guardar() {
    if (!cliente || !items.length) return toast.error("Seleccione cliente y productos");
    setBusy(true);
    const c: any = clientes?.find((x) => x.id === cliente);
    const rutaId = c?.cliente_rutas?.[0]?.ruta_id ?? c?.ruta_id ?? null;
    const id = crypto.randomUUID();
    const payload = { id, cliente_id: cliente, ruta_id: rutaId, fecha_entrega: f, total, notas: notas || null, usuario_id: usuarioId, items: items.map((i) => ({ producto_id: i.producto_id, nombre: i.nombre, cantidad: i.cantidad, precio: i.precio })) };
    if (!navigator.onLine) {
      await queuePedido(payload, usuarioId ?? "");
      setBusy(false);
      toast.info("Sin conexión: pedido guardado en el dispositivo");
      setItems([]); setCliente(""); setNotas(""); onOpenChange(false);
      return;
    }
    const { data: ped, error } = await supabase.from("pedidos").insert({ id, cliente_id: cliente, ruta_id: rutaId, fecha_entrega: f, total, notas: notas || null, usuario_id: usuarioId }).select("id").single();
    if (!error) {
      const { error: dErr } = await supabase.from("pedidos_detalle").insert(items.map((i) => ({ pedido_id: ped.id, producto_id: i.producto_id, nombre_producto: i.nombre, cantidad: i.cantidad, precio_unitario: i.precio })));
      if (dErr) { await supabase.from("pedidos").delete().eq("id", ped.id); setBusy(false); return toast.error(dErr.message); }
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Pedido registrado");
    invalidate(["pedidos"]);
    setItems([]); setCliente(""); setNotas("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>Nuevo pedido</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Cliente</Label>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={cliente} onChange={(e) => setCliente(e.target.value)}>
                <option value="">Seleccionar…</option>
                {(clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Entrega</Label><Input type="date" value={f} onChange={(e) => setF(e.target.value)} /></div>
          </div>
          <ItemsEditor items={items} onChange={setItems} nuevo={(b) => b} />
          <Textarea placeholder="Notas" value={notas} onChange={(e) => setNotas(e.target.value)} />
          <Button className="w-full" size="lg" disabled={busy} onClick={guardar}>{busy ? "Guardando…" : `Guardar · ${formatCRC(total)}`}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EntregarPedido({ pedido, onClose, vendedorId }: { pedido: any; onClose: () => void; vendedorId: string }) {
  const { data: cargas } = useCargasCamion();
  const { data: pendientes = [] } = usePendientesCamion();
  const invalidate = useInvalidate();
  const [items, setItems] = useState<LineaItem[]>(
    pedido.pedidos_detalle.map((l: any) => ({ producto_id: l.producto_id, nombre: l.nombre_producto, precio: Number(l.precio_unitario), cantidad: Number(l.cantidad) })),
  );
  const [metodo, setMetodo] = useState<"contado" | "credito">("contado");
  const [busy, setBusy] = useState(false);
  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);

  async function confirmar() {
    const entregados = items.filter((i) => i.cantidad > 0);
    if (!entregados.length) return toast.error("No hay productos entregados");
    const carga = cargas?.find((c) => c.id === pedido.carga_id);
    if (pedido.carga_id && (!carga || !validarVentaCamion(descontarPendientes(carga, pendientes), entregados))) return toast.error("Revise las existencias disponibles del camión");
    setBusy(true);
    const ventaP = { id: pedido.venta_id ?? pedido.id, carga_id: pedido.carga_id ?? null, cliente_id: pedido.cliente_id, ruta_id: pedido.ruta_id, vendedor_id: vendedorId, items: entregados, descuento: 0, metodo };
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
        carga_id: pedido.carga_id ?? null,
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
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo entregar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>Entregar a {pedido.clientes?.nombre}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Ajuste las cantidades si se entregó menos o más de lo pedido.</p>
          <ItemsEditor items={items} onChange={setItems} nuevo={(b) => b} />
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
