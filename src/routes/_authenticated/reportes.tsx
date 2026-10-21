import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useEmpresa } from "@/lib/empresa";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CatalogSelect } from "@/components/CatalogSelect";
import { cn } from "@/lib/utils";
import { esNumerica, formatoValor, tieneDecimales } from "@/lib/reporte-formato";
import { descargarReporteExcel, verReportePdf, type Reporte } from "@/lib/reporte-export";
import {
  carteraCobranza, clientesRiesgo, detalleGastos, detalleVentas, mermasDevoluciones,
  productosRotacion, rentabilidadRutas, resumenEjecutivo, type DatosReportes,
} from "@/lib/reportes-gerenciales";

export const Route = createFileRoute("/_authenticated/reportes")({
  head: () => ({
    meta: [
      { title: "Reportes gerenciales — Ruta Directo" },
      { name: "description", content: "Rentabilidad por ruta, mermas, cartera, clientes en riesgo y productos, en PDF y Excel." },
      { property: "og:title", content: "Reportes gerenciales — Ruta Directo" },
      { property: "og:description", content: "Rentabilidad por ruta, mermas, cartera, clientes en riesgo y productos, en PDF y Excel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportesPage,
});

type Preset = "hoy" | "semana" | "mes" | "mes_ant" | "90" | "custom";
const PRESETS: { key: Preset; label: string }[] = [
  { key: "hoy", label: "Hoy" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mes" },
  { key: "mes_ant", label: "Mes anterior" },
  { key: "90", label: "90 días" },
  { key: "custom", label: "Personalizado" },
];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function rango(p: Preset, desde: string, hasta: string): [string, string] {
  const h = new Date();
  if (p === "hoy") return [iso(h), iso(h)];
  if (p === "semana") {
    const d = new Date(h);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return [iso(d), iso(h)];
  }
  if (p === "mes") return [iso(new Date(h.getFullYear(), h.getMonth(), 1)), iso(h)];
  if (p === "mes_ant") return [iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)), iso(new Date(h.getFullYear(), h.getMonth(), 0))];
  if (p === "90") {
    const d = new Date(h);
    d.setDate(d.getDate() - 89);
    return [iso(d), iso(h)];
  }
  return [desde, hasta];
}

/** Lee todas las filas paginando de 1000 en 1000. */
async function todo<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await q(i, i + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

const REPORTES = [
  { key: "resumen", label: "Resumen", fn: resumenEjecutivo },
  { key: "rentabilidad", label: "Rentabilidad por ruta", fn: rentabilidadRutas },
  { key: "mermas", label: "Mermas y devoluciones", fn: mermasDevoluciones },
  { key: "cartera", label: "Cartera y cobranza", fn: carteraCobranza },
  { key: "clientes", label: "Clientes", fn: clientesRiesgo },
  { key: "productos", label: "Productos", fn: productosRotacion },
  { key: "ventas", label: "Ventas", fn: detalleVentas },
  { key: "gastos", label: "Gastos", fn: detalleGastos },
] as const;

function ReportesPage() {
  const { nombre: usuario } = useAuth();
  const { data: empresa } = useEmpresa();
  const hoy = iso(new Date());
  const [preset, setPreset] = useState<Preset>("mes");
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [ruta, setRuta] = useState("all");
  const [tab, setTab] = useState<(typeof REPORTES)[number]["key"]>("resumen");
  const [busy, setBusy] = useState<"" | "pdf" | "xlsx">("");
  const [ini, fin] = rango(preset, desde, hasta);

  const { data, isLoading, error } = useQuery({
    queryKey: ["reportes-gerenciales", ini, fin],
    queryFn: async () => {
      const a = new Date(`${ini}T00:00:00`).toISOString();
      const b = new Date(`${fin}T23:59:59.999`).toISOString();
      const hace90 = new Date(Date.now() - 90 * 86_400_000).toISOString();
      const [rutas, clientes, ventas, detalles, gastos, abonos, creditos, devoluciones, productos, historial] = await Promise.all([
        todo<any>((f, t) => supabase.from("rutas").select("id,nombre").range(f, t)),
        todo<any>((f, t) => supabase.from("clientes").select("id,nombre,activo,cliente_rutas(rutas(nombre))").range(f, t)),
        todo<any>((f, t) => supabase.from("ventas").select("id,fecha,total,metodo_pago,cliente_id,ruta_id").gte("fecha", a).lte("fecha", b).order("fecha").range(f, t)),
        todo<any>((f, t) => supabase.from("detalle_ventas").select("producto_id,nombre_producto,cantidad,total_linea,productos(costo,categorias(nombre)),ventas!inner(fecha,ruta_id,cliente_id)").gte("ventas.fecha", a).lte("ventas.fecha", b).range(f, t)),
        todo<any>((f, t) => supabase.from("gastos").select("fecha,monto,categoria,descripcion,ruta_id").gte("fecha", a).lte("fecha", b).order("fecha").range(f, t)),
        todo<any>((f, t) => supabase.from("abonos").select("fecha,monto,cliente_id").gte("fecha", a).lte("fecha", b).range(f, t)),
        todo<any>((f, t) => supabase.from("creditos").select("saldo,fecha,cliente_id").gt("saldo", 0).range(f, t)),
        todo<any>((f, t) => supabase.from("devoluciones").select("fecha,total,cliente_id,ruta_id,devoluciones_detalle(nombre_producto,cantidad,precio_unitario,motivo,destino)").gte("fecha", a).lte("fecha", b).range(f, t)),
        todo<any>((f, t) => supabase.from("productos").select("id,nombre,existencia,costo,activo,categorias(nombre)").range(f, t)),
        todo<any>((f, t) => supabase.from("ventas").select("fecha,total,cliente_id").gte("fecha", hace90).range(f, t)),
      ]);
      // Última compra histórica de clientes sin compras en 90 días
      return { rutas, clientes, ventas, detalles, gastos, abonos, creditos, devoluciones, productos, historial };
    },
  });

  const datos = useMemo<DatosReportes | null>(() => {
    if (!data) return null;
    const rutaNom = new Map<string, string>(data.rutas.map((r: any) => [r.id, r.nombre]));
    const cliNom = new Map<string, string>();
    const cliRutas = new Map<string, string[]>();
    for (const c of data.clientes) {
      cliNom.set(c.id, c.nombre);
      cliRutas.set(c.id, (c.cliente_rutas ?? []).map((x: any) => x.rutas?.nombre).filter(Boolean));
    }
    const rutaDe = (rutaId: string | null, cliId: string | null) =>
      (rutaId && rutaNom.get(rutaId)) || (cliId && cliRutas.get(cliId)?.[0]) || "Sin ruta";
    const ok = (r: string) => ruta === "all" || r === ruta;
    const okCli = (id: string | null) => ruta === "all" || (!!id && (cliRutas.get(id) ?? []).includes(ruta));

    const ultima = new Map<string, string>();
    const c90 = new Map<string, { n: number; t: number }>();
    for (const v of data.historial) {
      if (!v.cliente_id) continue;
      if (!ultima.has(v.cliente_id) || ultima.get(v.cliente_id)! < v.fecha) ultima.set(v.cliente_id, v.fecha);
      const x = c90.get(v.cliente_id) ?? { n: 0, t: 0 };
      x.n++;
      x.t += Number(v.total);
      c90.set(v.cliente_id, x);
    }

    return {
      hoy: new Date(),
      ventas: data.ventas.map((v: any) => ({ fecha: v.fecha, total: Number(v.total), metodo: v.metodo_pago, clienteId: v.cliente_id, cliente: cliNom.get(v.cliente_id) ?? "—", ruta: rutaDe(v.ruta_id, v.cliente_id) })).filter((v) => ok(v.ruta)),
      detalles: data.detalles.map((x: any) => ({
        productoId: x.producto_id, producto: x.nombre_producto, categoria: x.productos?.categorias?.nombre ?? "Sin categoría",
        cantidad: Number(x.cantidad), total: Number(x.total_linea), costo: Number(x.cantidad) * Number(x.productos?.costo ?? 0),
        ruta: rutaDe(x.ventas?.ruta_id, x.ventas?.cliente_id),
      })).filter((x) => ok(x.ruta)),
      gastos: data.gastos.map((g: any) => ({ fecha: g.fecha, monto: Number(g.monto), categoria: g.categoria, descripcion: g.descripcion ?? "", ruta: (g.ruta_id && rutaNom.get(g.ruta_id)) || "General" })).filter((g) => ok(g.ruta)),
      abonos: data.abonos.filter((x: any) => okCli(x.cliente_id)).map((x: any) => ({ fecha: x.fecha, monto: Number(x.monto) })),
      creditos: data.creditos.filter((c: any) => okCli(c.cliente_id)).map((c: any) => ({ cliente: cliNom.get(c.cliente_id) ?? "—", ruta: rutaDe(null, c.cliente_id), saldo: Number(c.saldo), fecha: c.fecha })),
      devoluciones: data.devoluciones.map((x: any) => ({
        fecha: x.fecha, total: Number(x.total), cliente: cliNom.get(x.cliente_id) ?? "—", ruta: rutaDe(x.ruta_id, x.cliente_id),
        lineas: (x.devoluciones_detalle ?? []).map((l: any) => ({ producto: l.nombre_producto, cantidad: Number(l.cantidad), monto: Number(l.cantidad) * Number(l.precio_unitario), motivo: l.motivo, destino: l.destino })),
      })).filter((x) => ok(x.ruta)),
      clientes: data.clientes.filter((c: any) => c.activo && okCli(c.id)).map((c: any) => ({
        id: c.id, nombre: c.nombre, ruta: (cliRutas.get(c.id) ?? []).join(", ") || "Sin ruta",
        ultimaCompra: ultima.get(c.id) ?? null, compras90: c90.get(c.id)?.n ?? 0, total90: c90.get(c.id)?.t ?? 0,
      })),
      productos: data.productos.filter((p: any) => p.activo).map((p: any) => ({ id: p.id, nombre: p.nombre, categoria: p.categorias?.nombre ?? "Sin categoría", existencia: Number(p.existencia), costo: Number(p.costo) })),
    };
  }, [data, ruta]);

  const reporte: Reporte | null = useMemo(() => (datos ? REPORTES.find((r) => r.key === tab)!.fn(datos) : null), [datos, tab]);
  const ctx = {
    periodo: ini === fin ? new Date(`${ini}T12:00:00`).toLocaleDateString("es-CR") : `${new Date(`${ini}T12:00:00`).toLocaleDateString("es-CR")} al ${new Date(`${fin}T12:00:00`).toLocaleDateString("es-CR")}`,
    ruta: ruta === "all" ? "Todas" : ruta,
    usuario: usuario ?? "",
  };

  async function exportar(tipo: "pdf" | "xlsx") {
    if (!reporte || !empresa) return;
    setBusy(tipo);
    try {
      if (tipo === "pdf") await verReportePdf(reporte, empresa, ctx);
      else {
        await descargarReporteExcel(reporte, empresa, ctx);
        toast.success("Excel descargado");
      }
    } catch (e: any) {
      toast.error("No se pudo generar el archivo", { description: e?.message });
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <PageHeader title="Reportes gerenciales" subtitle="Información para tomar decisiones" />
      <div className="space-y-4 p-4 md:p-6">
        <Card className="flex flex-wrap items-end gap-3 p-3">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <Button key={p.key} size="sm" variant={preset === p.key ? "default" : "outline"} onClick={() => setPreset(p.key)}>
                {p.label}
              </Button>
            ))}
          </div>
          {preset === "custom" && (
            <div className="flex items-center gap-2">
              <Input type="date" aria-label="Desde" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} className="h-9 w-40" />
              <span className="text-sm text-muted-foreground">a</span>
              <Input type="date" aria-label="Hasta" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} className="h-9 w-40" />
            </div>
          )}
          <div className="w-52">
            <CatalogSelect catalogo="rutas" incluirInactivas placeholder="Ruta" useNombre value={ruta} onChange={setRuta} extraOptions={[{ value: "all", label: "Todas las rutas" }]} />
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => exportar("pdf")} disabled={!reporte || !!busy} className="gap-1.5">
              <FileText className="h-4 w-4" /> {busy === "pdf" ? "Generando…" : "Ver PDF"}
            </Button>
            <Button onClick={() => exportar("xlsx")} disabled={!reporte || !!busy} className="gap-1.5">
              <FileSpreadsheet className="h-4 w-4" /> {busy === "xlsx" ? "Generando…" : "Excel"}
            </Button>
          </div>
        </Card>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="h-auto flex-wrap justify-start">
            {REPORTES.map((r) => (
              <TabsTrigger key={r.key} value={r.key}>{r.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {isLoading && <p className="py-10 text-center text-sm text-muted-foreground">Cargando datos…</p>}
        {error && <p className="py-10 text-center text-sm text-destructive">No se pudieron cargar los datos: {(error as Error).message}</p>}
        {reporte && <ReporteVista r={reporte} />}
      </div>
    </div>
  );
}

function ReporteVista({ r }: { r: Reporte }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{r.descripcion}</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {r.indicadores.map((i) => (
          <Card key={i.label} className="p-3">
            <p className="text-xs text-muted-foreground">{i.label}</p>
            <p className={cn("truncate text-lg font-black", typeof i.valor === "number" && i.valor < 0 && "text-destructive")}>
              {formatoValor(i.valor, i.tipo, i.tipo !== "moneda" && tieneDecimales([i.valor]))}
            </p>
          </Card>
        ))}
      </div>
      {r.secciones.map((s) => {
        const dec = s.columnas.map((c) => tieneDecimales([...s.filas.map((f) => f[c.key]), s.totales?.[c.key]]));
        return (
          <Card key={s.titulo} className="p-4">
            <h2 className="mb-3 font-bold">{s.titulo}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    {s.columnas.map((c) => (
                      <th key={c.key} className={cn("whitespace-nowrap py-2 pr-3 font-medium", esNumerica(c.tipo) && "text-right")}>{c.titulo}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.filas.slice(0, 200).map((f, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {s.columnas.map((c, j) => (
                        <td key={c.key} className={cn("py-1.5 pr-3", esNumerica(c.tipo) && "text-right tabular-nums", typeof f[c.key] === "number" && (f[c.key] as number) < 0 && "text-destructive")}>
                          {formatoValor(f[c.key], c.tipo, dec[j])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {s.totales && (
                  <tfoot>
                    <tr className="border-t-2 font-bold">
                      {s.columnas.map((c, j) => (
                        <td key={c.key} className={cn("py-2 pr-3", esNumerica(c.tipo) && "text-right tabular-nums")}>{formatoValor(s.totales![c.key], c.tipo, dec[j])}</td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
              {s.filas.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Sin datos para este período.</p>}
              {s.filas.length > 200 && <p className="mt-2 text-xs text-muted-foreground">Mostrando 200 de {s.filas.length}. El PDF y el Excel incluyen todo.</p>}
              {s.nota && <p className="mt-2 text-xs italic text-muted-foreground">{s.nota}</p>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
