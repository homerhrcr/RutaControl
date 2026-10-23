import { createFileRoute, Link } from "@tanstack/react-router";
import { useCargasCamion, usePendientesCamion, descontarPendientes } from "@/lib/carga-camion";
import { validarVentaCamion } from "@/lib/carga-camion-calculos";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClientes, useRutas, useInvalidate, registrarVenta } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { CatalogSelect } from "@/components/CatalogSelect";
import { ItemsEditor, type LineaItem } from "@/components/ItemsEditor";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { agruparEntregados, fechaEntregaHistorico, pedidoEntregado } from "@/lib/pedidos-historico";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCRC } from "@/lib/format";
import { toast } from "sonner";
import { queuePedido, queuePedidoEstado } from "@/lib/offline";
import { EntregarPedido } from "@/components/EntregarPedido";
import { Plus, Truck, CheckCircle2, XCircle, Pencil, Trash2, Folder } from "lucide-react";
import { CancelarPedido } from "@/components/CancelarPedido";
import { TelegramEnviar, PedidoTelegram } from "@/components/TelegramCliente";
import { notificarDocumentoTelegram } from "@/lib/telegram-notificar";
import { fechaLegible } from "@/lib/telegram";

export const Route = createFileRoute("/_authenticated/pedidos")({
  head: () => ({
    meta: [
      { title: "Preventa y pedidos — Ruta Directo" },
      { name: "description", content: "Preventas pendientes y pedidos entregados en un histórico por fecha, con carga y entrega en ruta." },
      { property: "og:title", content: "Preventa y pedidos — Ruta Directo" },
      { property: "og:description", content: "Preventas pendientes y pedidos entregados en un histórico por fecha, con carga y entrega en ruta." },
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
  cancelado: { label: "Cancelado", variant: "destructive" },
};

const norm = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
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
  const [busqueda, setBusqueda] = useState("");
  const [cancelar, setCancelar] = useState<any>(null);
  const [editar, setEditar] = useState<any>(null);

  const { data: pedidos } = useQuery({
    queryKey: ["pedidos", fecha, ruta],
    queryFn: async () => {
      let q = supabase.from("pedidos").select("*, clientes(nombre), rutas(nombre), pedidos_detalle(*), ventas(fecha)").order("fecha_entrega").order("created_at");
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

  const filtrados = useMemo(() => {
    const q = norm(busqueda.trim());
    return (pedidos ?? []).filter((p) =>
      (!fecha || (pedidoEntregado(p) ? fechaEntregaHistorico(p) : p.fecha_entrega) === fecha) &&
      (!q || norm(p.clientes?.nombre).includes(q) || norm(p.rutas?.nombre).includes(q) || norm(p.notas).includes(q))
    );
  }, [pedidos, busqueda, fecha]);
  const pendientes = filtrados.filter((p) => !pedidoEntregado(p));
  const historico = agruparEntregados(filtrados);
  const entregados = historico.reduce((total, grupo) => total + grupo.pedidos.length, 0);

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

  async function borrar(p: any) {
    if (p.carga_id) return toast.error("El pedido ya está cargado en un camión: cancélelo en vez de borrarlo");
    if (!navigator.onLine) return toast.error("Se necesita conexión para borrar un pedido");
    if (!confirm(`¿Borrar definitivamente el pedido de ${p.clientes?.nombre ?? "este cliente"}? Use esto solo si se registró por error.`)) return;
    const { error: dErr } = await supabase.from("pedidos_detalle").delete().eq("pedido_id", p.id);
    if (dErr) return toast.error(dErr.message);
    const { error } = await supabase.from("pedidos").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Pedido borrado");
    invalidate(["pedidos", "pedidos-carga-consolidado"]);
  }

  function fichaPedido(p: (typeof filtrados)[number]) {
    return (
              <Card key={p.id} className="space-y-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.clientes?.nombre}</p>
                    <p className="text-xs text-muted-foreground">{p.rutas?.nombre ?? "Sin ruta"}</p>
                    <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">📅 {pedidoEntregado(p) ? "Entregado" : "Entrega"}: {fechaLegible(pedidoEntregado(p) ? fechaEntregaHistorico(p) : p.fecha_entrega)}</p>
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
                {p.estado === "cancelado" && <p className="text-xs font-medium text-destructive">Motivo de cancelación: {p.motivo_cancelacion ?? "—"}</p>}
                {["confirmado", "cargado", "entregado"].includes(p.estado) && <PedidoTelegram pedidoId={p.id} clienteId={p.cliente_id} nombre={p.clientes?.nombre} rutaId={p.ruta_id} fechaEntrega={p.fecha_entrega} rutas={rutas ?? []} />}
                {p.estado === "entregado" && p.venta_id && <TelegramEnviar tipo="tiquete" documentoId={p.venta_id} />}
                {!["entregado", "anulado", "cancelado"].includes(p.estado) && (
                  <div className="flex flex-wrap gap-2">
                    {p.estado === "borrador" && <Button size="sm" variant="secondary" onClick={() => cambiarEstado(p.id, "confirmado")}>Confirmar</Button>}
                    <Button size="sm" onClick={() => setEntregar(p)}><CheckCircle2 className="mr-1 h-4 w-4" />Entregar y facturar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setCancelar(p)}><XCircle className="mr-1 h-4 w-4" />Cancelar pedido</Button>
                    <Button size="sm" variant="ghost" disabled={!!p.carga_id} title={p.carga_id ? "Ya está cargado en un camión" : undefined} onClick={() => setEditar(p)}><Pencil className="mr-1 h-4 w-4" />Editar</Button>
                    <Button size="sm" variant="ghost" disabled={!!p.carga_id} title={p.carga_id ? "Ya está cargado en un camión" : undefined} onClick={() => borrar(p)}><Trash2 className="mr-1 h-4 w-4" />Borrar</Button>
                  </div>
                )}
              </Card>
    );
  }

  return (
    <div>
      <PageHeader title="Preventa" subtitle="Pedidos previos a la entrega" action={<Button onClick={() => setNuevo(true)}><Plus className="mr-1 h-4 w-4" />Pedido</Button>} />
      <div className="space-y-4 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label className="text-xs">Fecha de entrega (vacío = todas)</Label><div className="flex gap-1"><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />{fecha && <Button variant="ghost" size="sm" className="h-10" onClick={() => setFecha("")}>Todas</Button>}</div></div>
          <CatalogSelect catalogo="rutas" incluirInactivas label="Ruta" placeholder="Ruta" value={ruta} onChange={setRuta} extraOptions={[{ value: "all", label: "Todas" }]} />
        </div>
        <Input placeholder="Buscar cliente…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar cliente" />
        <Tabs defaultValue="pedidos">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="pedidos">Pedidos ({pendientes.length})</TabsTrigger>
            <TabsTrigger value="historico">Histórico ({entregados})</TabsTrigger>
            <TabsTrigger value="carga">Carga del camión</TabsTrigger>
          </TabsList>
          <TabsContent value="pedidos" className="space-y-3">
            {pendientes.length === 0 && <p className="text-sm text-muted-foreground">No hay pedidos que coincidan.</p>}
            {pendientes.map(fichaPedido)}
          </TabsContent>
          <TabsContent value="historico">
            {historico.length === 0 && <p className="text-sm text-muted-foreground">No hay pedidos entregados que coincidan.</p>}
            <Accordion type="multiple">
              {historico.map((grupo) => (
                <AccordionItem key={grupo.fecha} value={grupo.fecha}>
                  <AccordionTrigger>
                    <span className="flex min-w-0 flex-wrap items-center gap-2"><Folder className="h-5 w-5 shrink-0 text-primary" /><span>{fechaLegible(grupo.fecha)}</span><Badge variant="secondary">{grupo.pedidos.length} entregados</Badge></span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">{grupo.pedidos.map(fichaPedido)}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
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
      {editar && <NuevoPedido key={editar.id} pedido={editar} open onOpenChange={(v) => !v && setEditar(null)} fecha={editar.fecha_entrega} usuarioId={user?.id} />}
      {cancelar && <CancelarPedido pedido={cancelar} onClose={() => setCancelar(null)} usuarioId={user?.id} />}
      {entregar && <EntregarPedido pedido={entregar} onClose={() => setEntregar(null)} vendedorId={user?.id ?? ""} />}
    </div>
  );
}

function NuevoPedido({ open, onOpenChange, fecha, usuarioId, pedido }: { open: boolean; onOpenChange: (v: boolean) => void; fecha: string; usuarioId?: string; pedido?: any }) {
  const { data: clientes } = useClientes();
  const invalidate = useInvalidate();
  const [cliente, setCliente] = useState(pedido?.cliente_id ?? "");
  const [f, setF] = useState(fecha);
  const [busqCli, setBusqCli] = useState("");
  const [items, setItems] = useState<LineaItem[]>(() => (pedido?.pedidos_detalle ?? []).map((l: any) => ({ producto_id: l.producto_id, nombre: l.nombre_producto, precio: Number(l.precio_unitario), cantidad: Number(l.cantidad) })));
  const [notas, setNotas] = useState(pedido?.notas ?? "");
  const [busy, setBusy] = useState(false);
  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);

  async function guardar() {
    if (!cliente || !items.length) return toast.error("Seleccione cliente y productos");
    setBusy(true);
    const c: any = clientes?.find((x) => x.id === cliente);
    const rutaId = c?.cliente_rutas?.[0]?.ruta_id ?? c?.ruta_id ?? null;
    if (pedido) {
      if (!navigator.onLine) { setBusy(false); return toast.error("Se necesita conexión para editar un pedido"); }
      const { data: actual } = await supabase.from("pedidos").select("estado, carga_id").eq("id", pedido.id).single();
      if (!actual || actual.carga_id || ["entregado", "anulado", "cancelado"].includes(actual.estado)) { setBusy(false); return toast.error("Este pedido ya no se puede editar (cargado, entregado o cancelado)"); }
      const { error: e1 } = await supabase.from("pedidos").update({ cliente_id: cliente, ruta_id: rutaId, fecha_entrega: f, total, notas: notas || null }).eq("id", pedido.id);
      if (e1) { setBusy(false); return toast.error(e1.message); }
      const { error: e2 } = await supabase.from("pedidos_detalle").delete().eq("pedido_id", pedido.id);
      if (e2) { setBusy(false); return toast.error(e2.message); }
      const { error: e3 } = await supabase.from("pedidos_detalle").insert(items.map((i) => ({ pedido_id: pedido.id, producto_id: i.producto_id, nombre_producto: i.nombre, cantidad: i.cantidad, precio_unitario: i.precio })));
      setBusy(false);
      if (e3) return toast.error(e3.message);
      toast.success("Pedido actualizado");
      invalidate(["pedidos", "pedidos-carga-consolidado"]);
      onOpenChange(false);
      return;
    }
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
        <DialogHeader><DialogTitle>{pedido ? "Editar pedido" : "Nuevo pedido"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Cliente</Label>
              <Input placeholder="Buscar cliente…" value={busqCli} onChange={(e) => setBusqCli(e.target.value)} className="mb-1 h-9" />
              <select aria-label="Cliente del pedido" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={cliente} onChange={(e) => { setCliente(e.target.value); setItems([]); }}>
                <option value="">Seleccionar…</option>
                {(clientes ?? []).filter((c) => c.id === cliente || norm(c.nombre).includes(norm(busqCli))).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Entrega</Label><Input type="date" value={f} onChange={(e) => setF(e.target.value)} /></div>
          </div>
          <ItemsEditor clienteId={cliente} rutaId={((clientes ?? []).find((x) => x.id === cliente) as any)?.cliente_rutas?.[0]?.ruta_id ?? (clientes ?? []).find((x) => x.id === cliente)?.ruta_id ?? null} items={items} onChange={setItems} nuevo={(b) => b} />
          <Textarea placeholder="Notas" value={notas} onChange={(e) => setNotas(e.target.value)} />
          <Button className="w-full" size="lg" disabled={busy} onClick={guardar}>{busy ? "Guardando…" : `Guardar · ${formatCRC(total)}`}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


