import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Truck, FileText, FileSpreadsheet, ArrowLeft, PackageCheck, Pencil, Folder } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRutas, useProductos } from "@/lib/data";
import { useCargasCamion, usePendientesCamion, descontarPendientes, enCamion, type CargaCamion } from "@/lib/carga-camion";
import { useEmpresa } from "@/lib/empresa";
import { useProductosCliente } from "@/lib/listas-precios";
import { estimarCarga } from "@/lib/carga-estimacion";
import { descargarReporteExcel, verReportePdf, type Reporte } from "@/lib/reporte-export";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useOnline, allOps } from "@/lib/offline";
import { MermaCamion } from "@/components/MermaCamion";
import { disponibleCamion, estadoStockCamion, validarMermaCamion } from "@/lib/carga-camion-calculos";
import { fechaLegible } from "@/lib/telegram";

export const Route = createFileRoute("/_authenticated/carga-camion")({
  head: () => ({ meta: [
    { title: "Carga de Camión — Ruta Directo" },
    { name: "description", content: "Carga de preventas y producto extra, inventario a bordo y liquidación de rutas." },
    { property: "og:title", content: "Carga de Camión — Ruta Directo" },
    { property: "og:description", content: "Inventario del camión, ventas en ruta y devolución de sobrantes a bodega." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: CargaCamionPage,
});
const hoy = () => new Date().toLocaleDateString("en-CA");
const numero = (n: number) => n.toLocaleString("es-CR", { maximumFractionDigits: 2 });

function CargaCamionPage() {
  const { data: cargas, isPending, error } = useCargasCamion();
  const { data: pendientes = [] } = usePendientesCamion();
  const { user, isAdmin } = useAuth();
  const online = useOnline();
  const [nueva, setNueva] = useState(false);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const carga = cargas?.find((c) => c.id === seleccion);
  const visibles = (cargas ?? []).filter((c) => isAdmin || c.vendedor_id === user?.id);
  return <div>
    <PageHeader title="Carga de Camión" subtitle="Preventa · Producto extra · Liquidación" action={<Button disabled={!online} onClick={() => setNueva(true)}><Plus className="mr-2 h-4 w-4" />Nueva carga</Button>} />
    <div className="space-y-4 p-4 md:p-6">
      {!online && <p className="text-sm text-warning">Sin conexión · Inventario guardado en el dispositivo. Cargas y cierres requieren conexión.</p>}
      {carga ? <><Button variant="ghost" onClick={() => setSeleccion(null)}><ArrowLeft className="mr-2 h-4 w-4" />Todas las cargas</Button><DetalleCarga carga={carga} pendientes={pendientes} /></> : <>
        <div className="flex flex-wrap items-center gap-5 border-b pb-4">
          <div><p className="text-xs text-muted-foreground">Camiones en ruta</p><p className="text-2xl font-bold">{visibles.filter((c) => c.estado === "en_ruta").length}</p></div>
          <div><p className="text-xs text-muted-foreground">Disponible para venta libre</p><p className="text-2xl font-bold text-primary">{numero(visibles.filter((c) => c.estado === "en_ruta").flatMap((c) => descontarPendientes(c, pendientes)).reduce((s, d) => s + disponibleCamion(d), 0))}</p></div>
        </div>
        {isPending && <p className="text-muted-foreground">Cargando…</p>}
        {error && <p className="text-destructive">No se pudieron leer las cargas. {error.message}</p>}
        {!isPending && !visibles.length && <div className="py-12 text-center"><Truck className="mx-auto mb-3 h-10 w-10 text-primary" /><p className="font-semibold">No hay cargas registradas</p></div>}
        {(() => {
          const ficha = (c: CargaCamion) => <div key={c.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-semibold">{c.rutas?.nombre}</h2><p className="text-sm text-muted-foreground">{c.fecha} · {c.vehiculo || "Sin identificación del vehículo"}</p></div><Badge variant={c.estado === "en_ruta" ? "default" : "secondary"}>{c.estado === "en_ruta" ? "En ruta" : "Cerrada"}</Badge></div>
            <div className="my-3 flex flex-wrap gap-4 text-sm"><span>{numero(c.cargas_camion_detalle.reduce((s, d) => s + Number(d.preventa) + Number(d.extra), 0))} cargadas</span><span>{numero(c.cargas_camion_detalle.reduce((s, d) => s + Number(d.vendido), 0))} vendidas</span>{c.estado === "en_ruta" && <span className="font-semibold text-primary">{numero(descontarPendientes(c, pendientes).reduce((s, d) => s + disponibleCamion(d), 0))} disponibles para vender</span>}{c.estado !== "en_ruta" && <><span>{numero(c.cargas_camion_detalle.reduce((s, d) => s + Number(d.devuelto), 0))} devueltas a bodega</span><span className="text-destructive">{numero(c.cargas_camion_detalle.reduce((s, d) => s + Number(d.merma), 0))} mermas</span></>}</div>
            <Button variant="outline" size="sm" onClick={() => setSeleccion(c.id)}>{c.estado === "en_ruta" ? "Ver carga / liquidar" : "Ver liquidación"}</Button>
          </div>;
          const activas = visibles.filter((c) => c.estado === "en_ruta");
          const grupos = new Map<string, CargaCamion[]>();
          for (const c of visibles) if (c.estado !== "en_ruta") grupos.set(c.fecha, [...(grupos.get(c.fecha) ?? []), c]);
          const historico = [...grupos.entries()].sort(([a], [b]) => b.localeCompare(a));
          return <Tabs defaultValue="activas">
            <TabsList><TabsTrigger value="activas">En ruta ({activas.length})</TabsTrigger><TabsTrigger value="historico">Histórico ({visibles.length - activas.length})</TabsTrigger></TabsList>
            <TabsContent value="activas">{!activas.length && <p className="text-sm text-muted-foreground">No hay camiones en ruta.</p>}<div className="grid gap-3 lg:grid-cols-2">{activas.map(ficha)}</div></TabsContent>
            <TabsContent value="historico">{!historico.length && <p className="text-sm text-muted-foreground">No hay cargas cerradas.</p>}
              <Accordion type="multiple">{historico.map(([fecha, cs]) => <AccordionItem key={fecha} value={fecha}><AccordionTrigger><span className="flex flex-wrap items-center gap-2"><Folder className="h-5 w-5 text-primary" />{fechaLegible(fecha)}<Badge variant="secondary">{cs.length} carga{cs.length === 1 ? "" : "s"}</Badge></span></AccordionTrigger><AccordionContent><div className="grid gap-3 lg:grid-cols-2">{cs.map(ficha)}</div></AccordionContent></AccordionItem>)}</Accordion>
            </TabsContent>
          </Tabs>;
        })()}
      </>}
    </div>
    {nueva && <NuevaCarga onClose={() => setNueva(false)} onDone={(id) => { setNueva(false); setSeleccion(id); }} />}
  </div>;
}

function NuevaCarga({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const { user, isAdmin } = useAuth();
  const { data: rutas } = useRutas();
  const { data: productos } = useProductos(true);
  const qc = useQueryClient();
  const [id] = useState(() => crypto.randomUUID());
  const [ruta, setRuta] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [vendedor, setVendedor] = useState(user?.id ?? "");
  const [vehiculo, setVehiculo] = useState("");
  const [notas, setNotas] = useState("");
  const [totales, setTotales] = useState<Record<string, number>>({});
  const [adicionales] = useState<string[]>([]);
  const [busca, setBusca] = useState("");
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const { data: miembros } = useQuery({ queryKey: ["cargas_camion-vendedores"], enabled: isAdmin, queryFn: async () => {
    const { data, error } = await supabase.from("organization_members").select("user_id, role").eq("estado", "active").in("role", ["vendedor", "administrador"]);
    if (error) throw error;
    const ids = [...new Set((data ?? []).map((m) => m.user_id))];
    if (!ids.length) return [];
    const { data: perfiles, error: e } = await supabase.from("profiles").select("id, nombre").in("id", ids);
    if (e) throw e;
    return perfiles ?? [];
  } });
  const { data: pedidos, isFetching } = useQuery({ queryKey: ["pedidos-carga", ruta], queryFn: async () => {
    // Todos los pedidos pendientes de la ruta, sin importar la fecha: la ruta puede tardar varios días.
    const { data, error } = await supabase.from("pedidos").select("*, clientes(nombre), pedidos_detalle(*)").or(ruta ? `ruta_id.eq.${ruta},ruta_id.is.null` : "ruta_id.is.null").in("estado", ["confirmado", "cargado"]).is("carga_id", null).order("fecha_entrega").order("created_at");
    if (error) throw error;
    return data;
  } });
  // Preselecciona las preventas cuya entrega es hasta la fecha de salida.
  useEffect(() => { setSeleccionados((pedidos ?? []).filter((p) => p.fecha_entrega <= fecha).map((p) => p.id)); }, [pedidos, fecha]);
  const resumen = useMemo(() => {
    const m = new Map<string, { id: string; nombre: string; preventa: number }>();
    const get = (pid: string, nombre: string) => { const d = m.get(pid) ?? { id: pid, nombre, preventa: 0 }; m.set(pid, d); return d; };
    for (const p of pedidos ?? []) if (seleccionados.includes(p.id)) for (const d of p.pedidos_detalle) get(d.producto_id, d.nombre_producto).preventa += Number(d.cantidad);
    for (const p of productos ?? []) get(p.id, p.nombre);
    for (const pid of adicionales) get(pid, "Producto");
    return [...m.values()].map((r) => { const total = totales[r.id] ?? r.preventa; return { ...r, total, libre: total - r.preventa }; });
  }, [pedidos, seleccionados, adicionales, totales, productos]);
  async function guardar() {
    if (!navigator.onLine) return toast.error("Se necesita conexión para registrar la carga");
    if (!ruta || !fecha || !vendedor || !resumen.some((r) => r.total > 0)) return toast.error("Seleccione ruta, fecha, vendedor y productos");
    if (resumen.some((r) => !Number.isFinite(r.total) || r.total < 0)) return toast.error("Las cantidades no pueden ser negativas");
    const faltan = resumen.find((r) => r.total < r.preventa);
    if (faltan) return toast.error(`Faltan ${numero(faltan.preventa - faltan.total)} de ${faltan.nombre} para cubrir los pedidos`);
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("abrir_carga_camion", { p: { id, ruta_id: ruta, fecha, vendedor_id: vendedor, vehiculo, notas, pedidos: seleccionados, totales: resumen.filter((r) => r.total > 0).map((r) => ({ producto_id: r.id, cantidad: r.total })) } });
      if (error) throw error;
      await Promise.all(["cargas_camion", "productos", "pedidos", "pedidos-carga", "pedidos-carga-consolidado"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      toast.success("Camión cargado");
      onDone(data);
    } catch (e) { toast.error(e instanceof Error ? e.message : String((e as { message?: string }).message ?? "No se pudo cargar")); } finally { setBusy(false); }
  }

  return <Dialog open onOpenChange={(o) => !o && !busy && onClose()}><DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Nueva carga de camión</DialogTitle><DialogDescription>Cantidades a bordo</DialogDescription></DialogHeader>
    <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor="carga-ruta">Ruta</Label><select id="carga-ruta" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={ruta} onChange={(e) => { setRuta(e.target.value); setSeleccionados([]); }}><option value="">Seleccionar ruta…</option>{rutas?.filter((r) => r.activo || r.id === ruta).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select></div><div className="space-y-1"><Label htmlFor="carga-fecha">Fecha de salida</Label><Input id="carga-fecha" type="date" value={fecha} onChange={(e) => { setFecha(e.target.value); setSeleccionados([]); }} /></div>
      <div className="space-y-1"><Label htmlFor="carga-vehiculo">Vehículo / placa</Label><Input id="carga-vehiculo" value={vehiculo} onChange={(e) => setVehiculo(e.target.value)} /></div>
      {isAdmin && <div className="space-y-1"><Label htmlFor="carga-vendedor">Vendedor responsable</Label><select id="carga-vendedor" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={vendedor} onChange={(e) => setVendedor(e.target.value)}><option value={user?.id}>Yo</option>{miembros?.filter((m) => m.id !== user?.id).map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></div>}
    </div>
    <section className="space-y-2 border-t pt-3"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Pedidos de preventa</h3><Button size="sm" variant="ghost" onClick={() => setSeleccionados((pedidos ?? []).map((p) => p.id))}>Seleccionar todos</Button></div>{isFetching && <p className="text-sm text-muted-foreground">Cargando pedidos…</p>}{!isFetching && !pedidos?.length && <p className="text-sm text-muted-foreground">No hay pedidos pendientes para esta ruta.</p>}{pedidos?.map((p) => <label key={p.id} className="flex items-center gap-3 border-b py-2 text-sm"><input type="checkbox" checked={seleccionados.includes(p.id)} onChange={(e) => setSeleccionados((s) => e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id))} /><span className="min-w-0 flex-1">{p.clientes?.nombre}{!p.ruta_id && <Badge variant="outline" className="ml-2">Sin ruta</Badge>}<span className="ml-2 text-xs text-muted-foreground">📅 {fechaLegible(p.fecha_entrega)}</span></span><span className="text-muted-foreground">{numero(p.pedidos_detalle.reduce((s, d) => s + Number(d.cantidad), 0))} unidades</span></label>)}</section>
    <section className="space-y-2 border-t pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Total que sube al camión</h3>
        <Input aria-label="Buscar producto" placeholder="Buscar producto…" className="h-9 w-56" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      <p className="text-xs text-muted-foreground">Digite la cantidad completa que se carga. Lo de los pedidos queda reservado y el resto queda libre para venta.</p>
      {!!resumen.length && <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-muted-foreground"><th className="py-2 text-left">Producto</th><th>Pedidos</th><th>Total a cargar</th><th>Libre venta</th></tr></thead><tbody>{resumen.filter((r) => r.preventa > 0 || r.total > 0 || r.nombre.toLowerCase().includes(busca.trim().toLowerCase())).sort((a, b) => b.preventa - a.preventa || a.nombre.localeCompare(b.nombre)).map((r) => <tr key={r.id} className="border-b"><td className="py-2">{r.nombre}</td><td className="text-center">{numero(r.preventa)}</td><td className="p-1 text-center"><Input aria-label={`Total ${r.nombre}`} type="number" min={0} step="1" inputMode="numeric" className={`mx-auto w-24 text-center ${r.total < r.preventa ? "border-destructive" : ""}`} value={Number.isFinite(r.total) ? r.total : ""} onChange={(e) => setTotales((s) => ({ ...s, [r.id]: e.target.value === "" ? NaN : Math.max(0, Number(e.target.value)) }))} /></td><td className={`text-center font-bold ${r.libre < 0 ? "text-destructive" : "text-primary"}`}>{r.libre < 0 ? `Faltan ${numero(-r.libre)}` : numero(r.libre)}</td></tr>)}</tbody></table></div>}
    </section>
    <Textarea aria-label="Notas de carga" placeholder="Notas de carga" value={notas} onChange={(e) => setNotas(e.target.value)} />
    <Button disabled={busy || isFetching || !resumen.length} onClick={guardar}><Truck className="mr-2 h-4 w-4" />{busy ? "Cargando…" : "Confirmar carga del camión"}</Button>
  </DialogContent></Dialog>;
}

function DetalleCarga({ carga, pendientes }: { carga: CargaCamion; pendientes: NonNullable<ReturnType<typeof usePendientesCamion>["data"]> }) {
  const { data: empresa } = useEmpresa();
  const { nombre, user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const online = useOnline();
  const [cerrar, setCerrar] = useState(false);
  const [registrarMerma, setRegistrarMerma] = useState(false);
  const [motivosMerma, setMotivosMerma] = useState<Record<string, string>>({});
  const [cierreGlobal, setCierreGlobal] = useState(false);
  const [mermas, setMermas] = useState<Record<string, number>>({});
  const [notas, setNotas] = useState("");
  const [busy, setBusy] = useState(false);
  const [pedidosAgregar, setPedidosAgregar] = useState<string[]>([]);
  const { data: pedidosPend } = useQuery({ queryKey: ["pedidos-carga", carga.ruta_id, "editar"], enabled: carga.estado === "en_ruta", queryFn: async () => {
    const { data, error } = await supabase.from("pedidos").select("id, fecha_entrega, clientes(nombre), pedidos_detalle(cantidad)").or(carga.ruta_id ? `ruta_id.eq.${carga.ruta_id},ruta_id.is.null` : "ruta_id.is.null").in("estado", ["confirmado", "cargado"]).is("carga_id", null).order("fecha_entrega");
    if (error) throw error;
    return data;
  } });
  const [editar, setEditar] = useState(false);
  const [extras, setExtras] = useState<Record<string, number>>({});
  const [vehiculoEd, setVehiculoEd] = useState("");
  const [agregarId, setAgregarId] = useState("");
  const { data: productosTodos } = useProductos();
  const { data: preciosRuta, listo: preciosListos, listaNombre, error: errorPrecios } = useProductosCliente(undefined, carga.ruta_id);
  const detalle = descontarPendientes(carga, pendientes);
  const cargado = (d: (typeof detalle)[number]) => Number(d.preventa) + Number(d.extra);
  const costoU = (pid: string) => Number(productosTodos?.find((x) => x.id === pid)?.costo ?? 0);
  const estimacion = estimarCarga(detalle, productosTodos ?? [], preciosRuta ?? []);
  const { costoTotal, ventaTotal } = estimacion;
  const valorLinea = (pid: string) => estimacion.filas.find((f) => f.producto_id === pid);
  const monedaEstimada = (n: number | null) => n === null ? "Pendiente de precio" : `₡${numero(n)}`;
  function abrirEdicion() {
    setExtras(Object.fromEntries(carga.cargas_camion_detalle.map((d) => [d.producto_id, Number(d.extra)])));
    setVehiculoEd(carga.vehiculo ?? ""); setAgregarId(""); setPedidosAgregar((pedidosPend ?? []).filter((p) => p.fecha_entrega <= carga.fecha).map((p) => p.id)); setEditar(true);
  }
  async function guardarEdicion() {
    if (!navigator.onLine) return toast.error("Editar la carga necesita conexión");
    if (Object.values(extras).some((n) => !Number.isFinite(n) || n < 0)) return toast.error("Las cantidades no pueden ser negativas");
    setBusy(true);
    try {
      const { error } = await supabase.rpc("editar_carga_camion", { p: { id: carga.id, vehiculo: vehiculoEd, pedidos: pedidosAgregar, extras: Object.entries(extras).map(([producto_id, extra]) => ({ producto_id, extra })) } });
      if (error) throw error;
      await Promise.all(["cargas_camion", "productos", "pedidos", "pedidos-carga"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      setEditar(false); toast.success("Carga actualizada");
    } catch (e) { toast.error(String((e as { message?: string }).message ?? "No se pudo editar")); } finally { setBusy(false); }
  }
  const nombreProd = (id: string) => carga.cargas_camion_detalle.find((d) => d.producto_id === id)?.nombre_producto ?? productosTodos?.find((x) => x.id === id)?.nombre ?? "";
  const locales = pendientes.filter((p) => p.carga_id === carga.id);
  const { data: ventas } = useQuery({ queryKey: ["ventas-camion", carga.id], queryFn: async () => {
    const { data, error } = await supabase.from("ventas").select("total, metodo_pago").eq("carga_id", carga.id);
    if (error) throw error;
    return data;
  } });
  const total = (ventas ?? []).reduce((s, v) => s + Number(v.total), 0);
  const { data: devsTodas } = useQuery({ queryKey: ["devoluciones-carga", carga.id], queryFn: async () => {
    const fin = new Date(`${carga.fecha}T00:00:00`); fin.setDate(fin.getDate() + 1);
    const { data, error } = await supabase.from("devoluciones").select("devoluciones_detalle(producto_id, cantidad, destino)").eq("ruta_id", carga.ruta_id).gte("fecha", `${carga.fecha}T00:00:00`).lt("fecha", fin.toISOString());
    if (error) throw error;
    return (data ?? []).flatMap((d) => d.devoluciones_detalle ?? []);
  } });
  const devsMerma = (devsTodas ?? []).filter((l) => l.destino === "merma");
  const devCliente = (pid: string) => (devsTodas ?? []).filter((l) => l.producto_id === pid).reduce((s, l) => s + Number(l.cantidad), 0);
  const cerrada = carga.estado !== "en_ruta";
  const costoVendido = detalle.reduce((s, d) => s + costoU(d.producto_id) * Number(d.vendido), 0);
  const perdidaMerma = detalle.reduce((s, d) => s + costoU(d.producto_id) * Number(d.merma), 0);
  const perdidaDevol = (devsMerma ?? []).reduce((s, l) => s + costoU(l.producto_id ?? "") * Number(l.cantidad), 0);
  const sobrantes = detalle.reduce((s, d) => s + costoU(d.producto_id) * Number(d.devuelto), 0);
  const utilidadReal = total - costoVendido - perdidaMerma - perdidaDevol;
  const resumen: [string, number | null][] = cerrada
    ? [["Ventas reales", total], ["Costo de lo vendido", costoVendido], ["Pérdida por merma", perdidaMerma], ["Pérdida por devoluciones", perdidaDevol], ["Sobrantes devueltos a bodega (no es pérdida)", sobrantes], ["Utilidad real de la ruta", utilidadReal]]
    : [["Costo total del producto que sale", costoTotal], ["Precio de venta estimado cargado", ventaTotal], ["Utilidad estimada", estimacion.utilidad]];
  const reporte: Reporte = { titulo: "Carga y liquidación de camión", descripcion: `${carga.vehiculo || "Camión"} · ${cerrada ? "Cerrada" : "En ruta"}${locales.length ? " · Incluye ventas pendientes de sincronizar" : ""}`, indicadores: [
    ...resumen.map(([label, valor]) => ({ label, valor: valor ?? "Pendiente de precio", tipo: valor === null ? "texto" as const : "moneda" as const })),
    { label: "Unidades cargadas", valor: detalle.reduce((s, d) => s + Number(d.preventa) + Number(d.extra), 0), tipo: "entero" },
    { label: "Unidades vendidas", valor: detalle.reduce((s, d) => s + Number(d.vendido), 0), tipo: "entero" },
    { label: "Ventas sincronizadas", valor: total, tipo: "moneda" },
    { label: "Contado", valor: (ventas ?? []).filter((v) => v.metodo_pago === "contado").reduce((s, v) => s + Number(v.total), 0), tipo: "moneda" },
    { label: "Crédito", valor: (ventas ?? []).filter((v) => v.metodo_pago === "credito").reduce((s, v) => s + Number(v.total), 0), tipo: "moneda" },
  ], secciones: [{ titulo: "Control de inventario", columnas: [
    { key: "nombre", titulo: "Producto", tipo: "texto" }, { key: "cargado", titulo: "Total cargado", tipo: "entero" }, { key: "preventa", titulo: "Preventa", tipo: "entero" },
    { key: "vendido", titulo: "Vendido", tipo: "entero" }, { key: "libre", titulo: "Disponible para vender", tipo: "entero" }, { key: "reservado", titulo: "Preventa pendiente", tipo: "entero" }, { key: "devcliente", titulo: "Devoluciones cliente", tipo: "entero" }, { key: "merma", titulo: "Merma", tipo: "entero" },
    { key: "costo", titulo: "Precio costo", tipo: "moneda" }, { key: "costoTotal", titulo: "Total costo", tipo: "moneda" },
    { key: "venta", titulo: "Precio venta estimado", tipo: "moneda" }, { key: "ventaTotal", titulo: "Total venta estimado", tipo: "moneda" },
  ], filas: detalle.map((d) => ({ nombre: d.nombre_producto, cargado: cargado(d), preventa: Number(d.preventa), vendido: Number(d.vendido), libre: disponibleCamion(d), reservado: Number(d.reservado ?? 0), devcliente: devCliente(d.producto_id), merma: Number(d.merma),
    costo: costoU(d.producto_id), costoTotal: costoU(d.producto_id) * cargado(d), venta: valorLinea(d.producto_id)?.venta ?? "Sin precio", ventaTotal: valorLinea(d.producto_id)?.ventaTotal ?? "Sin precio" })),
  totales: { nombre: "Total", cargado: detalle.reduce((s, d) => s + cargado(d), 0), preventa: detalle.reduce((s, d) => s + Number(d.preventa), 0), vendido: detalle.reduce((s, d) => s + Number(d.vendido), 0), libre: detalle.reduce((s,d) => s + disponibleCamion(d), 0), reservado: detalle.reduce((s,d) => s + Number(d.reservado ?? 0), 0), devcliente: detalle.reduce((s, d) => s + devCliente(d.producto_id), 0), merma: detalle.reduce((s, d) => s + Number(d.merma), 0), costo: "", costoTotal, venta: "", ventaTotal: ventaTotal ?? "Pendiente de precio" },
  nota: !cerrada ? `${listaNombre}. Estimación de venta de toda la carga (preventa + extra).${estimacion.faltantes.length ? " Hay productos sin precio: no se calcula utilidad hasta completar la lista de esta ruta." : ""}` : undefined,
  }] };
  async function exportar(tipo: "pdf" | "excel") {
    if (!preciosListos || productosTodos === undefined) return toast.error(errorPrecios ? "No se pudieron leer los precios de la ruta" : "Espere a que se carguen los costos y precios de la ruta");
    if (!empresa) return toast.error("Todavía no se han cargado los datos de la empresa");
    try { await (tipo === "pdf" ? verReportePdf : descargarReporteExcel)(reporte, empresa, { periodo: carga.fecha, ruta: carga.rutas?.nombre ?? "", usuario: nombre }); } catch { toast.error("No se pudo generar el documento"); }
  }
  async function liquidar() {
    if (!navigator.onLine) return toast.error("El cierre necesita conexión");
    const ops = await allOps();
    if (ops.some((o) => o.status !== "SYNCED" && (o.entity === "ventas" || o.entity === "entregas"))) return toast.error("Sincronice las ventas y entregas pendientes antes de cerrar");
    if (detalle.some((d) => (mermas[d.producto_id] ?? 0) < 0 || (mermas[d.producto_id] ?? 0) > enCamion(d))) return toast.error("La merma no puede superar el sobrante");
    if (detalle.some((d) => (mermas[d.producto_id] ?? 0) > 0 && !validarMermaCamion(mermas[d.producto_id], enCamion(d), motivosMerma[d.producto_id] ?? ""))) return toast.error("Justifique la merma de cada producto");
    setBusy(true);
    try {
      const { error } = await supabase.rpc("cerrar_carga_camion", { p: { id: carga.id, notas, mermas: Object.entries(mermas).map(([producto_id, cantidad]) => ({ producto_id, cantidad, motivo: motivosMerma[producto_id] ?? "" })) } });
      if (error) throw error;
      await Promise.all(["cargas_camion", "productos", "pedidos", "pedidos-carga", "pedidos-carga-consolidado"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      setCerrar(false); toast.success("Carga cerrada · Sobrantes devueltos a bodega");
    } catch (e) { toast.error(String((e as { message?: string }).message ?? "No se pudo cerrar")); } finally { setBusy(false); }
  }
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">{carga.rutas?.nombre}</h2><p className="text-sm text-muted-foreground">{carga.fecha} · {carga.vehiculo || "Sin placa"} · {carga.estado === "en_ruta" ? "En ruta" : "Cerrada"}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => exportar("pdf")}><FileText className="mr-2 h-4 w-4" />PDF</Button><Button size="sm" variant="outline" onClick={() => exportar("excel")}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button></div></div>
    {locales.length > 0 && <p className="text-sm text-warning">{locales.length} venta(s) pendientes de sincronizar · Descontadas del disponible local</p>}
    {!cerrada && <p className="text-xs text-muted-foreground">{listaNombre}</p>}
    {!cerrada && preciosListos && estimacion.faltantes.length > 0 && <p className="text-sm text-warning">Complete los precios de esta ruta para calcular la utilidad estimada: {detalle.filter((d) => estimacion.faltantes.includes(d.producto_id)).map((d) => d.nombre_producto).join(", ")}. <Link to="/administracion" className="underline">Administración → Rutas / Precios</Link></p>}
    <div className="grid gap-2 sm:grid-cols-3">{resumen.map(([l, v]) => <div key={l} className="rounded-md border p-3"><div className="text-xs text-muted-foreground">{l}</div><div className={`text-lg font-bold ${v !== null && v < 0 ? "text-destructive" : "text-primary"}`}>{!preciosListos || productosTodos === undefined ? "Cargando…" : monedaEstimada(v)}</div></div>)}</div>
    <section className="space-y-2"><h3 className="font-semibold">Valoración estimada de salida</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-muted-foreground"><th className="py-2 text-left">Producto</th><th>Cargado</th><th>Precio costo</th><th>Total costo</th><th>Precio venta estimado</th><th>Total venta estimado</th></tr></thead><tbody>{detalle.map((d) => { const f = valorLinea(d.producto_id); return <tr key={d.id} className="border-b"><td className="py-2">{d.nombre_producto}</td><td className="text-right">{numero(cargado(d))}</td><td className="text-right">{monedaEstimada(f?.costo ?? null)}</td><td className="text-right">{monedaEstimada(f?.costoTotal ?? null)}</td><td className="text-right">{monedaEstimada(f?.venta ?? null)}</td><td className="text-right">{monedaEstimada(f?.ventaTotal ?? null)}</td></tr>; })}</tbody><tfoot><tr className="border-t font-bold"><td className="py-2" colSpan={3}>Total estimado</td><td className="text-right">{monedaEstimada(costoTotal)}</td><td></td><td className="text-right">{monedaEstimada(ventaTotal)}</td></tr></tfoot></table></div></section>
    <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="border-b text-muted-foreground"><th className="py-3 text-left">Producto</th><th>Total cargado</th><th>Preventa</th><th>Vendido</th><th>Disponible para vender</th><th>Preventa pendiente</th><th>Devoluciones cliente</th><th>Merma</th></tr></thead><tbody>{detalle.map((d) => <tr key={d.id} className="border-b"><td className="py-3 font-medium">{d.nombre_producto}</td>{[cargado(d), d.preventa, d.vendido, disponibleCamion(d), d.reservado, devCliente(d.producto_id), d.merma].map((n, i) => <td key={i} className={`text-center ${i === 3 ? (estadoStockCamion(disponibleCamion(d)) !== "disponible" && !cerrada ? "stock-bajo" : "font-bold text-primary") : ""}`}>{i === 3 && Number(n) === 0 && !cerrada ? "Agotado" : numero(Number(n))}</td>)}</tr>)}</tbody></table></div>
    {cerrada && <div className="grid gap-3 md:grid-cols-2">
      {([["Sobrantes devueltos a bodega", "devuelto", "Producto en buen estado: decida si reasignarlo a otra ruta, promocionarlo o controlar su vencimiento."], ["Productos en merma", "merma", "Producto dañado, vencido o perdido: no regresa a bodega."]] as const).map(([t, k, ayuda]) => { const filas = detalle.filter((d) => Number(d[k]) > 0); return <div key={k} className="rounded-md border p-3"><h3 className="font-semibold">{t} ({numero(filas.reduce((s, d) => s + Number(d[k]), 0))} u.)</h3><p className="mb-2 text-xs text-muted-foreground">{ayuda}</p>{filas.length ? <ul className="space-y-1 text-sm">{filas.map((d) => <li key={d.id} className="flex justify-between gap-3 border-b py-1"><span>{d.nombre_producto}</span><span className="font-bold">{numero(Number(d[k]))}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">Sin {k === "devuelto" ? "sobrantes" : "mermas"}.</p>}</div>; })}
    </div>}
    {carga.notas && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{carga.notas}</p>}
    {carga.estado === "en_ruta" && <div className="flex flex-wrap gap-3"><Button variant="outline" asChild><Link to="/ruta"><Truck className="mr-2 h-4 w-4" />Ventas en ruta</Link></Button>{isAdmin && <Button variant="outline" disabled={!online} onClick={abrirEdicion}><Pencil className="mr-2 h-4 w-4" />Editar carga</Button>}{(isAdmin || carga.vendedor_id === user?.id) && <Button disabled={!online || locales.length > 0} onClick={() => setCerrar(true)}><PackageCheck className="mr-2 h-4 w-4" />Liquidar y registrar sobrantes</Button>}{(isAdmin || carga.vendedor_id === user?.id) && <Button variant="outline" disabled={!online || locales.length > 0} onClick={() => setRegistrarMerma(true)}>Registrar merma</Button>}{isAdmin && <Button variant="secondary" disabled={!online || locales.length > 0} onClick={() => setCierreGlobal(true)}><PackageCheck className="mr-2 h-4 w-4" />Cierre global de ruta</Button>}</div>}
    <Dialog open={editar} onOpenChange={(o) => !busy && setEditar(o)}><DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto"><DialogHeader><DialogTitle>Editar carga</DialogTitle><DialogDescription>Ajuste el producto extra a bordo. La diferencia se descuenta o regresa a bodega.</DialogDescription></DialogHeader>
      {!!pedidosPend?.length && <section className="space-y-1 border-b pb-3"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Preventas pendientes de cargar</h3><Button size="sm" variant="ghost" onClick={() => setPedidosAgregar(pedidosPend.map((p) => p.id))}>Seleccionar todos</Button></div>{pedidosPend.map((p) => <label key={p.id} className="flex items-center gap-3 py-1 text-sm"><input type="checkbox" checked={pedidosAgregar.includes(p.id)} onChange={(e) => setPedidosAgregar((s) => e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id))} /><span className="flex-1">{p.clientes?.nombre} <span className="text-xs text-muted-foreground">📅 {fechaLegible(p.fecha_entrega)}</span></span><span className="text-muted-foreground">{numero(p.pedidos_detalle.reduce((s, d) => s + Number(d.cantidad), 0))} u.</span></label>)}<p className="text-xs text-muted-foreground">Los pedidos marcados se suben al camión y se descuentan de bodega.</p></section>}
      <div className="space-y-1"><Label htmlFor="ed-vehiculo">Vehículo / placa</Label><Input id="ed-vehiculo" value={vehiculoEd} onChange={(e) => setVehiculoEd(e.target.value)} /></div>
      <table className="w-full text-sm"><thead><tr className="border-b"><th className="py-2 text-left">Producto</th><th>Preventa</th><th>Extra</th></tr></thead><tbody>{Object.keys(extras).map((pid) => { const d = carga.cargas_camion_detalle.find((x) => x.producto_id === pid); return <tr key={pid} className="border-b"><td className="py-2">{nombreProd(pid)}</td><td className="text-center">{numero(Number(d?.preventa ?? 0))}</td><td className="p-2"><Input aria-label={`Extra ${nombreProd(pid)}`} type="number" min={0} step="0.01" className="w-24" value={extras[pid]} onChange={(e) => setExtras((s) => ({ ...s, [pid]: Number(e.target.value) }))} /></td></tr>; })}</tbody></table>
      <div className="flex gap-2"><select aria-label="Agregar producto" className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm" value={agregarId} onChange={(e) => setAgregarId(e.target.value)}><option value="">Agregar producto…</option>{(productosTodos ?? []).filter((x) => x.activo && !(x.id in extras)).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select><Button type="button" variant="outline" disabled={!agregarId} onClick={() => { setExtras((s) => ({ ...s, [agregarId]: 1 })); setAgregarId(""); }}><Plus className="h-4 w-4" /></Button></div>
      <Button disabled={busy} onClick={guardarEdicion}>{busy ? "Guardando…" : "Guardar cambios"}</Button>
    </DialogContent></Dialog>
    <Dialog open={cerrar} onOpenChange={(o) => !busy && setCerrar(o)}><DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto"><DialogHeader><DialogTitle>Liquidar carga de camión</DialogTitle><DialogDescription>Sobrantes y productos dañados</DialogDescription></DialogHeader>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="py-2 text-left">Producto</th><th>Sobrante</th><th>Daños / merma</th><th>Justificación</th><th>Regresa</th></tr></thead><tbody>{detalle.filter((d) => enCamion(d) > 0).map((d) => <tr key={d.id} className="border-b"><td className="py-2">{d.nombre_producto}</td><td className="text-center">{numero(enCamion(d))}</td><td className="p-2"><Input aria-label={`Merma ${d.nombre_producto}`} type="number" min={0} max={enCamion(d)} step="0.01" value={mermas[d.producto_id] ?? 0} onChange={(e) => setMermas((s) => ({ ...s, [d.producto_id]: Number(e.target.value) }))} className="w-20" /></td><td className="p-2">{(mermas[d.producto_id] ?? 0) > 0 && <Input aria-label={`Justificación ${d.nombre_producto}`} value={motivosMerma[d.producto_id] ?? ""} onChange={(e) => setMotivosMerma((s) => ({ ...s, [d.producto_id]: e.target.value }))} />}</td><td className="text-center font-bold">{numero(enCamion(d) - (mermas[d.producto_id] ?? 0))}</td></tr>)}</tbody></table></div>
      <Textarea aria-label="Observaciones de liquidación" placeholder="Observaciones / motivo de la merma" value={notas} onChange={(e) => setNotas(e.target.value)} />
      <Button disabled={busy} onClick={liquidar}>{busy ? "Cerrando…" : "Confirmar cierre y retorno a bodega"}</Button>
    </DialogContent></Dialog>
    {registrarMerma && <MermaCamion cargaId={carga.id} detalle={detalle} onClose={() => setRegistrarMerma(false)} />}
    {cierreGlobal && <CierreGlobal carga={carga} detalle={detalle} precioDe={(pid) => valorLinea(pid)?.venta ?? null} onClose={() => setCierreGlobal(false)} />}
  </section>;
}

function CierreGlobal({ carga, detalle, precioDe, onClose }: { carga: CargaCamion; detalle: ReturnType<typeof descontarPendientes>; precioDe: (pid: string) => number | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [sob, setSob] = useState<Record<string, number>>({});
  const [mer, setMer] = useState<Record<string, number>>({});
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [contado, setContado] = useState("");
  const [credito, setCredito] = useState("");
  const [notas, setNotas] = useState("");
  const [busy, setBusy] = useState(false);
  const filas = detalle.filter((d) => enCamion(d) > 0).map((d) => {
    const s = sob[d.producto_id] ?? 0, m = mer[d.producto_id] ?? 0, vend = enCamion(d) - s - m, precio = precioDe(d.producto_id);
    return { d, s, m, vend, precio, total: vend > 0 && precio !== null ? vend * precio : 0 };
  });
  const total = filas.reduce((a, f) => a + f.total, 0);
  const diferencia = Number(contado || 0) + Number(credito || 0) - total;
  const sinPrecio = filas.filter((f) => f.vend > 0 && f.precio === null);
  async function confirmar() {
    if (filas.some((f) => f.s < 0 || f.m < 0 || f.vend < 0)) return toast.error("Sobrante y merma no pueden superar lo que quedó en el camión");
    if (filas.some((f) => f.m > 0 && !validarMermaCamion(f.m, enCamion(f.d), motivos[f.d.producto_id] ?? ""))) return toast.error("Justifique la merma de cada producto");
    if (sinPrecio.length) return toast.error(`Falta el precio de: ${sinPrecio.map((f) => f.d.nombre_producto).join(", ")}`);
    if (Number(contado) < 0 || Number(credito) < 0) return toast.error("Los montos no pueden ser negativos");
    if ((Math.abs(diferencia) > 0.009) && !notas.trim()) return toast.error("Explique el faltante o sobrante de caja en las observaciones");
    setBusy(true);
    try {
      const { error } = await supabase.rpc("cierre_global_ruta", { p: { carga_id: carga.id, contado: Number(contado || 0), credito: Number(credito || 0), notas, items: filas.map((f) => ({ producto_id: f.d.producto_id, sobrante: f.s, merma: f.m, motivo: motivos[f.d.producto_id] ?? "", precio: f.precio })) } });
      if (error) throw error;
      await Promise.all(["cargas_camion", "productos", "pedidos", "ventas", "ventas-camion", "creditos-pendientes", "creditos-ruta", "dashboard"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      toast.success("Ruta cerrada · Venta y crédito registrados a nombre de la ruta");
      onClose();
    } catch (e) { toast.error(String((e as { message?: string }).message ?? "No se pudo cerrar la ruta")); } finally { setBusy(false); }
  }
  const num = (v: number | undefined) => v ?? 0;
  return <Dialog open onOpenChange={(o) => !o && !busy && onClose()}><DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
    <DialogHeader><DialogTitle>Cierre global de ruta</DialogTitle><DialogDescription>Anote lo que regresó y lo que se dañó. El resto se toma como vendido a precio de la ruta.</DialogDescription></DialogHeader>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-muted-foreground"><th className="py-2 text-left">Producto</th><th>Quedó</th><th>Regresó</th><th>Merma</th><th>Justificación</th><th>Vendido</th><th className="text-right">Total</th></tr></thead><tbody>
      {filas.map((f) => <tr key={f.d.id} className="border-b"><td className="py-2">{f.d.nombre_producto}</td><td className="text-center">{numero(enCamion(f.d))}</td>
        <td className="p-1"><Input aria-label={`Regresó ${f.d.nombre_producto}`} type="number" min={0} value={num(sob[f.d.producto_id])} onChange={(e) => setSob((s) => ({ ...s, [f.d.producto_id]: Number(e.target.value) }))} className="w-20" /></td>
        <td className="p-1"><Input aria-label={`Merma ${f.d.nombre_producto}`} type="number" min={0} value={num(mer[f.d.producto_id])} onChange={(e) => setMer((s) => ({ ...s, [f.d.producto_id]: Number(e.target.value) }))} className="w-20" /></td>
        <td className="p-1">{f.m > 0 && <Input aria-label={`Justificación ${f.d.nombre_producto}`} value={motivos[f.d.producto_id] ?? ""} onChange={(e) => setMotivos((s) => ({ ...s, [f.d.producto_id]: e.target.value }))} />}</td>
        <td className={`text-center font-bold ${f.vend < 0 ? "text-destructive" : ""}`}>{numero(f.vend)}</td><td className="text-right">{f.precio === null ? (f.vend > 0 ? "Sin precio" : "—") : `₡${numero(f.total)}`}</td></tr>)}
    </tbody></table></div>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Total vendido</div><div className="text-lg font-bold text-primary">₡{numero(total)}</div></div>
      <div className="space-y-1"><Label htmlFor="cg-contado">Dinero de contado</Label><Input id="cg-contado" type="number" min={0} value={contado} onChange={(e) => setContado(e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="cg-credito">Quedó a crédito</Label><Input id="cg-credito" type="number" min={0} value={credito} onChange={(e) => setCredito(e.target.value)} /></div>
    </div>
    <p className={`text-sm font-semibold ${Math.abs(diferencia) < 0.01 ? "text-primary" : "text-warning"}`}>{Math.abs(diferencia) < 0.01 ? "Cuadra exacto" : diferencia < 0 ? `Faltante de caja: ₡${numero(-diferencia)}` : `Sobrante de caja: ₡${numero(diferencia)}`}</p>
    <Textarea aria-label="Observaciones del cierre" placeholder="Observaciones (obligatorio si hay faltante, sobrante o merma)" value={notas} onChange={(e) => setNotas(e.target.value)} />
    <Button disabled={busy} onClick={confirmar}>{busy ? "Cerrando…" : "Confirmar cierre de ruta"}</Button>
  </DialogContent></Dialog>;
}