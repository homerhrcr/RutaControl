import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { formatCRC } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { TrendingUp, CreditCard, AlertTriangle, Wallet, Map } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const now = new Date();
      const startDay = new Date(now); startDay.setHours(0, 0, 0, 0);
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [ventas, creditos, detalle, rutas, ventasAll, clientes] = await Promise.all([
        supabase.from("ventas").select("total, fecha, ruta_id").gte("fecha", startMonth.toISOString()),
        supabase.from("creditos").select("saldo, estado, fecha_limite").gt("saldo", 0),
        supabase.from("detalle_ventas").select("nombre_producto, cantidad"),
        supabase.from("rutas").select("id, nombre"),
        supabase.from("ventas").select("ruta_id, total"),
        supabase.from("clientes").select("ruta_id"),
      ]);

      const v = ventas.data ?? [];
      const hoy = v.filter((x) => new Date(x.fecha) >= startDay).reduce((s, x) => s + Number(x.total), 0);
      const mes = v.reduce((s, x) => s + Number(x.total), 0);

      const cred = creditos.data ?? [];
      const creditoActivo = cred.reduce((s, c) => s + Number(c.saldo), 0);
      const creditoVencido = cred
        .filter((c) => c.fecha_limite && new Date(c.fecha_limite) < now)
        .reduce((s, c) => s + Number(c.saldo), 0);

      const prodMap: Record<string, number> = {};
      for (const d of detalle.data ?? []) prodMap[d.nombre_producto] = (prodMap[d.nombre_producto] ?? 0) + Number(d.cantidad);
      const topProductos = Object.entries(prodMap)
        .map(([nombre, cant]) => ({ nombre: nombre.length > 14 ? nombre.slice(0, 14) + "…" : nombre, cant }))
        .sort((a, b) => b.cant - a.cant)
        .slice(0, 6);

      const rutaMap: Record<string, number> = {};
      for (const x of v) if (x.ruta_id) rutaMap[x.ruta_id] = (rutaMap[x.ruta_id] ?? 0) + Number(x.total);
      const porRuta = (rutas.data ?? []).map((r) => ({ nombre: r.nombre.replace("Ruta ", ""), total: rutaMap[r.id] ?? 0 }));

      const ventaStats: Record<string, { total: number; n: number }> = {};
      for (const x of ventasAll.data ?? []) {
        if (!x.ruta_id) continue;
        ventaStats[x.ruta_id] = {
          total: (ventaStats[x.ruta_id]?.total ?? 0) + Number(x.total),
          n: (ventaStats[x.ruta_id]?.n ?? 0) + 1,
        };
      }
      const clienteStats: Record<string, number> = {};
      for (const x of clientes.data ?? []) if (x.ruta_id) clienteStats[x.ruta_id] = (clienteStats[x.ruta_id] ?? 0) + 1;
      const rutasDetalle = (rutas.data ?? []).map((r) => ({
        id: r.id,
        nombre: r.nombre,
        total: ventaStats[r.id]?.total ?? 0,
        ventas: ventaStats[r.id]?.n ?? 0,
        clientes: clienteStats[r.id] ?? 0,
      }));

      return { hoy, mes, creditoActivo, creditoVencido, topProductos, porRuta, rutasDetalle };
    },
  });

  return (
    <div>
      <PageHeader title="Dashboard Gerencial" subtitle="Resumen del mes" />
      <div className="space-y-4 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={Wallet} label="Ventas hoy" value={formatCRC(data?.hoy ?? 0)} to="/ventas" />
          <Stat icon={TrendingUp} label="Ventas mes" value={formatCRC(data?.mes ?? 0)} tone="accent" to="/ventas" />
          <Stat icon={CreditCard} label="Crédito activo" value={formatCRC(data?.creditoActivo ?? 0)} tone="warning" to="/cobranza" />
          <Stat icon={AlertTriangle} label="Crédito vencido" value={formatCRC(data?.creditoVencido ?? 0)} tone="destructive" to="/cobranza" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Link to="/productos" className="block">
            <Card className="p-4 transition-shadow hover:shadow-md">
              <h2 className="mb-3 font-bold">Productos más vendidos</h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data?.topProductos ?? []} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis dataKey="nombre" type="category" width={90} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Bar dataKey="cant" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Link>

          <Card className="p-4">
            <h2 className="mb-3 font-bold">Ventas por ruta</h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data?.porRuta ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="nombre" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <Tooltip
                  formatter={(v: number) => formatCRC(v)}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                />
                <Bar dataKey="total" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <div>
          <h2 className="mb-3 font-bold">Rutas de Distribución</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {(data?.rutasDetalle ?? []).map((r) => (
              <Card key={r.id} className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                    <Map className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold">{r.nombre}</h3>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-lg font-black">{formatCRC(r.total)}</p><p className="text-xs text-muted-foreground">Ingresos</p></div>
                  <div><p className="text-lg font-black">{r.ventas}</p><p className="text-xs text-muted-foreground">Ventas</p></div>
                  <div><p className="text-lg font-black">{r.clientes}</p><p className="text-xs text-muted-foreground">Clientes</p></div>
                </div>
              </Card>
            ))}
          </div>
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
  to,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  tone?: "primary" | "accent" | "warning" | "destructive";
  to: string;
}) {
  const map = {
    primary: "bg-primary/15 text-primary",
    accent: "bg-accent/15 text-accent",
    warning: "bg-warning/20 text-warning",
    destructive: "bg-destructive/15 text-destructive",
  };
  return (
    <Link to={to} className="block">
      <Card className="p-3 transition-shadow hover:shadow-md">
        <div className={cn("mb-2 grid h-9 w-9 place-items-center rounded-lg", map[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-lg font-black">{value}</p>
      </Card>
    </Link>
  );
}
