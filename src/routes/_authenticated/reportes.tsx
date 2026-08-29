import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRutas } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CatalogSelect } from "@/components/CatalogSelect";
import { formatCRC } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { TrendingUp, Receipt, Banknote, Users, FileSpreadsheet, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reportes")({
  component: ReportesPage,
});

type RangeKey = "7" | "30" | "90";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "7", label: "7 días" },
  { key: "30", label: "30 días" },
  { key: "90", label: "90 días" },
];

type VentaRow = {
  total: number;
  fecha: string;
  metodo_pago: string;
  cliente_id: string;
  clienteNombre: string;
  rutaNombre: string;
};

type GastoRow = {
  monto: number;
  fecha: string;
  categoria: string;
  descripcion: string;
  rutaNombre: string;
};

function ReportesPage() {
  const [range, setRange] = useState<RangeKey>("30");
  const [rutaFiltro, setRutaFiltro] = useState<string>("all");
  const [exporting, setExporting] = useState(false);
  const { data: rutas } = useRutas();

  const { data } = useQuery({
    queryKey: ["reportes", range],
    queryFn: async () => {
      const days = Number(range);
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - (days - 1));

      const [ventasRes, abonosRes, gastosRes] = await Promise.all([
        supabase
          .from("ventas")
          .select("total, fecha, metodo_pago, cliente_id, clientes(nombre, cliente_rutas(rutas(nombre)))")
          .gte("fecha", start.toISOString())
          .order("fecha", { ascending: true }),
        supabase.from("abonos").select("monto, fecha").gte("fecha", start.toISOString()),
        supabase
          .from("gastos")
          .select("monto, fecha, categoria, descripcion, ruta_id, rutas(nombre)")
          .gte("fecha", start.toISOString())
          .order("fecha", { ascending: true }),
      ]);

      const abonos = abonosRes.data ?? [];
      const ventas: VentaRow[] = (ventasRes.data ?? []).map((v: any) => ({
        total: Number(v.total),
        fecha: v.fecha,
        metodo_pago: v.metodo_pago,
        cliente_id: v.cliente_id,
        clienteNombre: v.clientes?.nombre ?? "—",
        rutaNombre: v.clientes?.cliente_rutas?.[0]?.rutas?.nombre ?? "Sin ruta",
      }));

      const gastos: GastoRow[] = (gastosRes.data ?? []).map((g: any) => ({
        monto: Number(g.monto),
        fecha: g.fecha,
        categoria: g.categoria,
        descripcion: g.descripcion ?? "",
        rutaNombre: g.rutas?.nombre ?? "General",
      }));

      const totalVentas = ventas.reduce((s, v) => s + v.total, 0);
      const totalContado = ventas.filter((v) => v.metodo_pago === "contado").reduce((s, v) => s + v.total, 0);
      const totalCredito = totalVentas - totalContado;
      const totalCobrado = abonos.reduce((s, a) => s + Number(a.monto), 0);
      const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);
      const clientesAtendidos = new Set(ventas.map((v) => v.cliente_id)).size;

      return { totalVentas, totalContado, totalCredito, totalCobrado, totalGastos, clientesAtendidos, ventas, gastos };
    },
  });

  const ventasFiltradas = useMemo(() => {
    const v = data?.ventas ?? [];
    return rutaFiltro === "all" ? v : v.filter((x) => x.rutaNombre === rutaFiltro);
  }, [data, rutaFiltro]);

  const resumenFiltrado = useMemo(() => {
    const total = ventasFiltradas.reduce((s, v) => s + v.total, 0);
    const contado = ventasFiltradas.filter((v) => v.metodo_pago === "contado").reduce((s, v) => s + v.total, 0);
    return { total, contado, credito: total - contado, count: ventasFiltradas.length };
  }, [ventasFiltradas]);

  async function descargarExcel() {
    if (!data?.ventas?.length) return toast.error("No hay ventas en el rango seleccionado");
    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = "Ruta Directo";
      wb.created = new Date();

      const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? "";

      // group by ruta
      const porRuta = new Map<string, VentaRow[]>();
      for (const v of data.ventas) {
        if (!porRuta.has(v.rutaNombre)) porRuta.set(v.rutaNombre, []);
        porRuta.get(v.rutaNombre)!.push(v);
      }

      const buildSheet = (name: string, rows: VentaRow[], titulo: string) => {
        const ws = wb.addWorksheet(name.slice(0, 31), {
          pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } },
          headerFooter: { oddFooter: "Página &P de &N", oddHeader: "&LRuta Directo&RReporte de Ventas" },
        });
        ws.columns = [
          { width: 12 },
          { width: 28 },
          { width: 22 },
          { width: 14 },
          { width: 16 },
        ];

        ws.mergeCells("A1:E1");
        const t = ws.getCell("A1");
        t.value = "Ruta Directo";
        t.font = { bold: true, size: 16, color: { argb: "FF1F4E2C" } };
        t.alignment = { horizontal: "center" };

        ws.mergeCells("A2:E2");
        const s = ws.getCell("A2");
        s.value = `${titulo} · Últimos ${rangeLabel}`;
        s.font = { size: 11, color: { argb: "FF555555" } };
        s.alignment = { horizontal: "center" };

        ws.addRow([]);
        const header = ws.addRow(["Fecha", "Cliente", "Ruta", "Método", "Total"]);
        header.eachCell((c) => {
          c.font = { bold: true, color: { argb: "FFFFFFFF" } };
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E2C" } };
          c.alignment = { horizontal: "center", vertical: "middle" };
          c.border = { bottom: { style: "thin", color: { argb: "FFCCCCCC" } } };
        });

        let total = 0;
        for (const v of rows) {
          total += v.total;
          const r = ws.addRow([
            new Date(v.fecha).toLocaleDateString("es-CR"),
            v.clienteNombre,
            v.rutaNombre,
            v.metodo_pago === "contado" ? "Contado" : "Crédito",
            v.total,
          ]);
          r.getCell(5).numFmt = '"₡"#,##0';
          r.getCell(5).alignment = { horizontal: "right" };
          r.eachCell((c) => (c.border = { bottom: { style: "hair", color: { argb: "FFEEEEEE" } } }));
        }

        const totalRow = ws.addRow(["", "", "", "TOTAL", total]);
        totalRow.getCell(4).font = { bold: true };
        totalRow.getCell(4).alignment = { horizontal: "right" };
        totalRow.getCell(5).font = { bold: true };
        totalRow.getCell(5).numFmt = '"₡"#,##0';
        totalRow.getCell(5).alignment = { horizontal: "right" };

        ws.views = [{ state: "frozen", ySplit: 4 }];
      };

      buildSheet("Ventas Globales", data.ventas, "Ventas Globales");
      for (const [ruta, rows] of porRuta) buildSheet(ruta, rows, `Ruta: ${ruta}`);

      // Hoja de gastos
      if (data.gastos.length) {
        const CAT_LABEL: Record<string, string> = {
          viaticos: "Viáticos",
          combustible: "Combustible",
          insumos: "Insumos",
          otros: "Otros",
        };
        const wg = wb.addWorksheet("Gastos", {
          pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } },
          headerFooter: { oddFooter: "Página &P de &N", oddHeader: "&LRuta Directo&RReporte de Gastos" },
        });
        wg.columns = [{ width: 12 }, { width: 16 }, { width: 30 }, { width: 18 }, { width: 16 }];
        wg.mergeCells("A1:E1");
        const tg = wg.getCell("A1");
        tg.value = "Ruta Directo";
        tg.font = { bold: true, size: 16, color: { argb: "FF1F4E2C" } };
        tg.alignment = { horizontal: "center" };
        wg.mergeCells("A2:E2");
        const sg = wg.getCell("A2");
        sg.value = `Gastos · Últimos ${rangeLabel}`;
        sg.font = { size: 11, color: { argb: "FF555555" } };
        sg.alignment = { horizontal: "center" };
        wg.addRow([]);
        const hg = wg.addRow(["Fecha", "Categoría", "Descripción", "Ruta", "Monto"]);
        hg.eachCell((c) => {
          c.font = { bold: true, color: { argb: "FFFFFFFF" } };
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB00020" } };
          c.alignment = { horizontal: "center", vertical: "middle" };
        });
        let totalG = 0;
        for (const g of data.gastos) {
          totalG += g.monto;
          const r = wg.addRow([
            new Date(g.fecha).toLocaleDateString("es-CR"),
            CAT_LABEL[g.categoria] ?? g.categoria,
            g.descripcion,
            g.rutaNombre,
            g.monto,
          ]);
          r.getCell(5).numFmt = '"₡"#,##0';
          r.getCell(5).alignment = { horizontal: "right" };
        }
        const trg = wg.addRow(["", "", "", "TOTAL", totalG]);
        trg.getCell(4).font = { bold: true };
        trg.getCell(4).alignment = { horizontal: "right" };
        trg.getCell(5).font = { bold: true };
        trg.getCell(5).numFmt = '"₡"#,##0';
        trg.getCell(5).alignment = { horizontal: "right" };
        wg.views = [{ state: "frozen", ySplit: 4 }];
      }


      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte-ventas-${rangeLabel.replace(/\s/g, "")}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Reporte descargado");
    } catch (e: any) {
      toast.error("Error al generar el Excel: " + (e?.message ?? ""));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <PageHeader title="Reportes" subtitle="Análisis de ventas y cobranza" />
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {RANGES.map((r) => (
              <Button
                key={r.key}
                variant={range === r.key ? "default" : "outline"}
                size="sm"
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </Button>
            ))}
          </div>
          <Button onClick={descargarExcel} disabled={exporting} className="gap-1.5">
            <FileSpreadsheet className="h-4 w-4" />
            {exporting ? "Generando…" : "Descargar Excel"}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <Stat icon={TrendingUp} label="Ventas totales" value={formatCRC(data?.totalVentas ?? 0)} />
          <Stat icon={Banknote} label="Cobrado" value={formatCRC(data?.totalCobrado ?? 0)} tone="accent" />
          <Stat icon={Receipt} label="A crédito" value={formatCRC(data?.totalCredito ?? 0)} tone="warning" />
          <Stat icon={Wallet} label="Gastos" value={formatCRC(data?.totalGastos ?? 0)} tone="destructive" />
          <Stat icon={TrendingUp} label="Neto (ventas - gastos)" value={formatCRC((data?.totalVentas ?? 0) - (data?.totalGastos ?? 0))} tone="primary" />
          <Stat icon={Users} label="Clientes atendidos" value={String(data?.clientesAtendidos ?? 0)} tone="primary" />
        </div>

        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold">Ventas por ruta</h2>
            <div className="w-52">
              <CatalogSelect
                catalogo="rutas"
                placeholder="Ruta"
                useNombre
                value={rutaFiltro}
                onChange={setRutaFiltro}
                extraOptions={[{ value: "all", label: "Todas las rutas" }]}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Mini label="Ventas" value={String(resumenFiltrado.count)} />
            <Mini label="Total" value={formatCRC(resumenFiltrado.total)} />
            <Mini label="Contado" value={formatCRC(resumenFiltrado.contado)} />
            <Mini label="Crédito" value={formatCRC(resumenFiltrado.credito)} />
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Fecha</th>
                  <th className="py-2 pr-3 font-medium">Cliente</th>
                  <th className="py-2 pr-3 font-medium">Ruta</th>
                  <th className="py-2 pr-3 font-medium">Método</th>
                  <th className="py-2 pr-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {ventasFiltradas.slice(0, 100).map((v, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1.5 pr-3">{new Date(v.fecha).toLocaleDateString("es-CR")}</td>
                    <td className="py-1.5 pr-3">{v.clienteNombre}</td>
                    <td className="py-1.5 pr-3">{v.rutaNombre}</td>
                    <td className="py-1.5 pr-3">{v.metodo_pago === "contado" ? "Contado" : "Crédito"}</td>
                    <td className="py-1.5 pr-3 text-right font-medium">{formatCRC(v.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ventasFiltradas.length > 100 && (
              <p className="mt-2 text-xs text-muted-foreground">Mostrando 100 de {ventasFiltradas.length}. Descarga el Excel para ver todo.</p>
            )}
            {ventasFiltradas.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Sin ventas para esta selección.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate font-bold">{value}</p>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone = "primary",
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  tone?: "primary" | "accent" | "warning" | "destructive";
}) {
  const map = {
    primary: "bg-primary/15 text-primary",
    accent: "bg-accent/15 text-accent",
    warning: "bg-warning/20 text-warning",
    destructive: "bg-destructive/15 text-destructive",
  };
  return (
    <Card className="p-3">
      <div className={cn("mb-2 grid h-9 w-9 place-items-center rounded-lg", map[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-lg font-black">{value}</p>
    </Card>
  );
}
