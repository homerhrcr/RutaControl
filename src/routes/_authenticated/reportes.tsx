import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCRC } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Download, TrendingUp, Receipt, Banknote, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reportes")({
  component: ReportesPage,
});

type RangeKey = "7" | "30" | "90";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "7", label: "7 días" },
  { key: "30", label: "30 días" },
  { key: "90", label: "90 días" },
];

function ReportesPage() {
  const [range, setRange] = useState<RangeKey>("30");

  const { data } = useQuery({
    queryKey: ["reportes", range],
    queryFn: async () => {
      const days = Number(range);
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - (days - 1));

      const [ventasRes, abonosRes, detalleRes] = await Promise.all([
        supabase
          .from("ventas")
          .select("total, fecha, metodo_pago, cliente_id")
          .gte("fecha", start.toISOString())
          .order("fecha", { ascending: true }),
        supabase
          .from("abonos")
          .select("monto, fecha")
          .gte("fecha", start.toISOString()),
        supabase
          .from("detalle_ventas")
          .select("nombre_producto, cantidad, total_linea, venta_id"),
      ]);

      const ventas = ventasRes.data ?? [];
      const abonos = abonosRes.data ?? [];

      const totalVentas = ventas.reduce((s, v) => s + Number(v.total), 0);
      const totalContado = ventas
        .filter((v) => v.metodo_pago === "contado")
        .reduce((s, v) => s + Number(v.total), 0);
      const totalCredito = totalVentas - totalContado;
      const totalCobrado = abonos.reduce((s, a) => s + Number(a.monto), 0);
      const clientesAtendidos = new Set(ventas.map((v) => v.cliente_id)).size;

      // Daily series
      const dayMap: Record<string, number> = {};
      for (let i = 0; i < days; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        dayMap[d.toISOString().slice(0, 10)] = 0;
      }
      for (const v of ventas) {
        const k = new Date(v.fecha).toISOString().slice(0, 10);
        if (k in dayMap) dayMap[k] += Number(v.total);
      }
      const serie = Object.entries(dayMap).map(([fecha, total]) => ({
        fecha: fecha.slice(5),
        total,
      }));

      // Top products
      const prodMap: Record<string, { cantidad: number; monto: number }> = {};
      for (const d of detalleRes.data ?? []) {
        const p = (prodMap[d.nombre_producto] ??= { cantidad: 0, monto: 0 });
        p.cantidad += Number(d.cantidad);
        p.monto += Number(d.total_linea);
      }
      const topProductos = Object.entries(prodMap)
        .map(([nombre, v]) => ({ nombre, ...v }))
        .sort((a, b) => b.monto - a.monto)
        .slice(0, 10);

      return {
        totalVentas,
        totalContado,
        totalCredito,
        totalCobrado,
        clientesAtendidos,
        serie,
        topProductos,
        ventas,
      };
    },
  });


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
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={TrendingUp} label="Ventas totales" value={formatCRC(data?.totalVentas ?? 0)} />
          <Stat icon={Banknote} label="Cobrado" value={formatCRC(data?.totalCobrado ?? 0)} tone="accent" />
          <Stat icon={Receipt} label="A crédito" value={formatCRC(data?.totalCredito ?? 0)} tone="warning" />
          <Stat icon={Users} label="Clientes atendidos" value={String(data?.clientesAtendidos ?? 0)} tone="primary" />
        </div>

      </div>
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
