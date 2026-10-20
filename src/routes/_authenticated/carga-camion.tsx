import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Truck, FileText, FileSpreadsheet, ArrowLeft, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRutas, useProductos } from "@/lib/data";
import { useCargasCamion, usePendientesCamion, descontarPendientes, enCamion, type CargaCamion } from "@/lib/carga-camion";
import { useEmpresa } from "@/lib/empresa";
import { descargarReporteExcel, verReportePdf, type Reporte } from "@/lib/reporte-export";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useOnline, allOps } from "@/lib/offline";
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
          <div><p className="text-xs text-muted-foreground">Unidades a bordo</p><p className="text-2xl font-bold text-primary">{numero(visibles.filter((c) => c.estado === "en_ruta").flatMap((c) => descontarPendientes(c, pendientes)).reduce((s, d) => s + enCamion(d), 0))}</p></div>
        </div>
        {isPending && <p className="text-muted-foreground">Cargando…</p>}
        {error && <p className="text-destructive">No se pudieron leer las cargas. {error.message}</p>}
        {!isPending && !visibles.length && <div className="py-12 text-center"><Truck className="mx-auto mb-3 h-10 w-10 text-primary" /><p className="font-semibold">No hay cargas registradas</p></div>}
        <div className="grid gap-3 lg:grid-cols-2">{visibles.map((c) => <div key={c.id} className="rounded-lg border bg-card p-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-semibold">{c.rutas?.nombre}</h2><p className="text-sm text-muted-foreground">{c.fecha} · {c.vehiculo || "Sin identificación del vehículo"}</p></div><Badge variant={c.estado === "en_ruta" ? "default" : "secondary"}>{c.estado === "en_ruta" ? "En ruta" : "Cerrada"}</Badge></div>
          <div className="my-3 flex flex-wrap gap-4 text-sm"><span>{numero(c.cargas_camion_detalle.reduce((s, d) => s + Number(d.preventa) + Number(d.extra), 0))} cargadas</span><span>{numero(c.cargas_camion_detalle.reduce((s, d) => s + Number(d.vendido), 0))} vendidas</span><span className="font-semibold text-primary">{numero(descontarPendientes(c, pendientes).reduce((s, d) => s + enCamion(d), 0))} a bordo</span></div>
          <Button variant="outline" size="sm" onClick={() => setSeleccion(c.id)}>Ver carga / liquidar</Button>
        </div>)}</div>
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
    <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor="carga-ruta">Ruta</Label><select id="carga-ruta" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={ruta} onChange={(e) => { setRuta(e.target.value); setSeleccionados([]); }}><option value="">Seleccionar ruta…</option>{rutas?.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select></div><div className="space-y-1"><Label htmlFor="carga-fecha">Fecha de salida</Label><Input id="carga-fecha" type="date" value={fecha} onChange={(e) => { setFecha(e.target.value); setSeleccionados([]); }} /></div>
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
  const [mermas, setMermas] = useState<Record<string, number>>({});
  const [notas, setNotas] = useState("");
  const [busy, setBusy] = useState(false);
  const detalle = descontarPendientes(carga, pendientes);
  const locales = pendientes.filter((p) => p.carga_id === carga.id);
  const { data: ventas } = useQuery({ queryKey: ["ventas-camion", carga.id], queryFn: async () => {
    const { data, error } = await supabase.from("ventas").select("total, metodo_pago").eq("carga_id", carga.id);
    if (error) throw error;
    return data;
  } });
  const total = (ventas ?? []).reduce((s, v) => s + Number(v.total), 0);
  const reporte: Reporte = { titulo: "Carga y liquidación de camión", descripcion: `${carga.vehiculo || "Camión"} · ${carga.estado === "en_ruta" ? "En ruta" : "Cerrada"}${locales.length ? " · Incluye ventas pendientes de sincronizar" : ""}`, indicadores: [
    { label: "Unidades cargadas", valor: detalle.reduce((s, d) => s + Number(d.preventa) + Number(d.extra), 0), tipo: "entero" },
    { label: "Unidades vendidas", valor: detalle.reduce((s, d) => s + Number(d.vendido), 0), tipo: "entero" },
    { label: "Ventas sincronizadas", valor: total, tipo: "moneda" },
    { label: "Contado", valor: (ventas ?? []).filter((v) => v.metodo_pago === "contado").reduce((s, v) => s + Number(v.total), 0), tipo: "moneda" },
    { label: "Crédito", valor: (ventas ?? []).filter((v) => v.metodo_pago === "credito").reduce((s, v) => s + Number(v.total), 0), tipo: "moneda" },
  ], secciones: [{ titulo: "Control de inventario", columnas: [
    { key: "nombre", titulo: "Producto", tipo: "texto" }, { key: "preventa", titulo: "Preventa", tipo: "entero" }, { key: "extra", titulo: "Extra", tipo: "entero" },
    { key: "vendido", titulo: "Vendido", tipo: "entero" }, { key: "abordo", titulo: "A bordo", tipo: "entero" }, { key: "devuelto", titulo: "Devuelto a bodega", tipo: "entero" }, { key: "merma", titulo: "Merma", tipo: "entero" },
  ], filas: detalle.map((d) => ({ nombre: d.nombre_producto, preventa: Number(d.preventa), extra: Number(d.extra), vendido: Number(d.vendido), abordo: enCamion(d), devuelto: Number(d.devuelto), merma: Number(d.merma) })) }] };
  async function exportar(tipo: "pdf" | "excel") {
    if (!empresa) return toast.error("Todavía no se han cargado los datos de la empresa");
    try { await (tipo === "pdf" ? verReportePdf : descargarReporteExcel)(reporte, empresa, { periodo: carga.fecha, ruta: carga.rutas?.nombre ?? "", usuario: nombre }); } catch { toast.error("No se pudo generar el documento"); }
  }
  async function liquidar() {
    if (!navigator.onLine) return toast.error("El cierre necesita conexión");
    const ops = await allOps();
    if (ops.some((o) => o.status !== "SYNCED" && (o.entity === "ventas" || o.entity === "entregas"))) return toast.error("Sincronice las ventas y entregas pendientes antes de cerrar");
    if (detalle.some((d) => (mermas[d.producto_id] ?? 0) < 0 || (mermas[d.producto_id] ?? 0) > enCamion(d))) return toast.error("La merma no puede superar el sobrante");
    if (Object.values(mermas).some((n) => n > 0) && !notas.trim()) return toast.error("Indique el motivo de los productos dañados");
    setBusy(true);
    try {
      const { error } = await supabase.rpc("cerrar_carga_camion", { p: { id: carga.id, notas, mermas: Object.entries(mermas).map(([producto_id, cantidad]) => ({ producto_id, cantidad })) } });
      if (error) throw error;
      await Promise.all(["cargas_camion", "productos", "pedidos", "pedidos-carga", "pedidos-carga-consolidado"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
      setCerrar(false); toast.success("Carga cerrada · Sobrantes devueltos a bodega");
    } catch (e) { toast.error(String((e as { message?: string }).message ?? "No se pudo cerrar")); } finally { setBusy(false); }
  }
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">{carga.rutas?.nombre}</h2><p className="text-sm text-muted-foreground">{carga.fecha} · {carga.vehiculo || "Sin placa"} · {carga.estado === "en_ruta" ? "En ruta" : "Cerrada"}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => exportar("pdf")}><FileText className="mr-2 h-4 w-4" />PDF</Button><Button size="sm" variant="outline" onClick={() => exportar("excel")}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button></div></div>
    {locales.length > 0 && <p className="text-sm text-warning">{locales.length} venta(s) pendientes de sincronizar · Descontadas del disponible local</p>}
    <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="border-b text-muted-foreground"><th className="py-3 text-left">Producto</th><th>Preventa</th><th>Extra</th><th>Vendido</th><th>A bordo</th><th>Reservado</th><th>Libre venta</th><th>Devuelto</th><th>Merma</th></tr></thead><tbody>{detalle.map((d) => <tr key={d.id} className="border-b"><td className="py-3 font-medium">{d.nombre_producto}</td>{[d.preventa, d.extra, d.vendido, enCamion(d), d.reservado, Math.max(0, enCamion(d) - d.reservado), d.devuelto, d.merma].map((n, i) => <td key={i} className={`text-center ${i === 3 ? "font-bold text-primary" : ""}`}>{numero(Number(n))}</td>)}</tr>)}</tbody></table></div>
    {carga.notas && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{carga.notas}</p>}
    {carga.estado === "en_ruta" && <div className="flex flex-wrap gap-3"><Button variant="outline" asChild><Link to="/ruta"><Truck className="mr-2 h-4 w-4" />Ventas en ruta</Link></Button>{(isAdmin || carga.vendedor_id === user?.id) && <Button disabled={!online || locales.length > 0} onClick={() => setCerrar(true)}><PackageCheck className="mr-2 h-4 w-4" />Liquidar y registrar sobrantes</Button>}</div>}
    <Dialog open={cerrar} onOpenChange={(o) => !busy && setCerrar(o)}><DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto"><DialogHeader><DialogTitle>Liquidar carga de camión</DialogTitle><DialogDescription>Sobrantes y productos dañados</DialogDescription></DialogHeader>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="py-2 text-left">Producto</th><th>Sobrante</th><th>Daños / merma</th><th>Regresa</th></tr></thead><tbody>{detalle.filter((d) => enCamion(d) > 0).map((d) => <tr key={d.id} className="border-b"><td className="py-2">{d.nombre_producto}</td><td className="text-center">{numero(enCamion(d))}</td><td className="p-2"><Input aria-label={`Merma ${d.nombre_producto}`} type="number" min={0} max={enCamion(d)} step="0.01" value={mermas[d.producto_id] ?? 0} onChange={(e) => setMermas((s) => ({ ...s, [d.producto_id]: Number(e.target.value) }))} className="w-20" /></td><td className="text-center font-bold">{numero(enCamion(d) - (mermas[d.producto_id] ?? 0))}</td></tr>)}</tbody></table></div>
      <Textarea aria-label="Observaciones de liquidación" placeholder="Observaciones / motivo de la merma" value={notas} onChange={(e) => setNotas(e.target.value)} />
      <Button disabled={busy} onClick={liquidar}>{busy ? "Cerrando…" : "Confirmar cierre y retorno a bodega"}</Button>
    </DialogContent></Dialog>
  </section>;
}