import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
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
  Cell,
  PieChart,
  Pie,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { TrendingUp, CreditCard, AlertTriangle, Wallet, Map, Receipt, ClipboardList, Undo2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard Gerencial — Ruta Directo" },
      { name: "description", content: "Resumen de ventas, gastos, preventas, devoluciones y rutas de Ruta Directo." },
      { property: "og:title", content: "Dashboard Gerencial — Ruta Directo" },
      { property: "og:description", content: "Resumen de ventas, gastos, preventas, devoluciones y rutas de Ruta Directo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

const PALETA = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--primary)",
  "var(--destructive)",
];

const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 };

function diasSerie(n: number) {
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    out.push({ key: d.toDateString(), label: `${d.getDate()}/${d.getMonth() + 1}` });
  }
  return out;
}

export function DashboardPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdmin) navigate({ to: "/ruta", replace: true });
  }, [isAdmin, navigate]);

  const { data } = useQuery({
    enabled: isAdmin,
    queryKey: ["dashboard"],
    queryFn: async () => {
      const now = new Date();
      const startDay = new Date(now); startDay.setHours(0, 0, 0, 0);
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const hace14 = new Date(startDay); hace14.setDate(hace14.getDate() - 13);

      const [ventas, creditos, detalle, rutas, clientes, clienteRutas, gastosAll, pedidos, devoluciones] = await Promise.all([
        supabase.from("ventas").select("id, total, fecha, ruta_id, cliente_id").gte("fecha", startMonth.toISOString()),
        supabase.from("creditos").select("saldo, estado, fecha_limite").gt("saldo", 0),
        supabase.from("detalle_ventas").select("nombre_producto, cantidad, ventas!inner(fecha)").gte("ventas.fecha", startMonth.toISOString()),
        supabase.from("rutas").select("id, nombre").order("nombre"),
        supabase.from("clientes").select("id, ruta_id"),
        supabase.from("cliente_rutas").select("cliente_id, ruta_id"),
        supabase.from("gastos").select("monto, fecha").gte("fecha", startMonth.toISOString()),
        supabase.from("pedidos").select("estado, total, created_at, fecha_entrega").gte("created_at", hace14.toISOString()),
        supabase.from("devoluciones").select("fecha, total, devoluciones_detalle(cantidad, precio_unitario, destino)").gte("fecha", hace14.toISOString()),
      ]);

      const v = ventas.data ?? [];
      const hoy = v.filter((x) => new Date(x.fecha) >= startDay).reduce((s, x) => s + Number(x.total), 0);
      const mes = v.reduce((s, x) => s + Number(x.total), 0);

      const g = gastosAll.data ?? [];
      const gastosHoy = g.filter((x) => new Date(x.fecha) >= startDay).reduce((s, x) => s + Number(x.monto), 0);
      const gastosMes = g.reduce((s, x) => s + Number(x.monto), 0);

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

      // Ruta de la venta: la de la venta, o la ruta principal del cliente
      const rutaCliente: Record<string, string> = {};
      for (const c of clientes.data ?? []) if (c.ruta_id) rutaCliente[c.id] = c.ruta_id;
      for (const cr of clienteRutas.data ?? []) if (!rutaCliente[cr.cliente_id]) rutaCliente[cr.cliente_id] = cr.ruta_id;
      const rutaDe = (x: { ruta_id: string | null; cliente_id: string | null }) =>
        x.ruta_id ?? (x.cliente_id ? rutaCliente[x.cliente_id] : undefined);

      const stats: Record<string, { total: number; n: number }> = {};
      for (const x of v) {
        const r = rutaDe(x);
        if (!r) continue;
        stats[r] = { total: (stats[r]?.total ?? 0) + Number(x.total), n: (stats[r]?.n ?? 0) + 1 };
      }
      const clientesPorRuta: Record<string, Set<string>> = {};
      for (const cr of clienteRutas.data ?? []) (clientesPorRuta[cr.ruta_id] ??= new Set()).add(cr.cliente_id);
      for (const c of clientes.data ?? []) if (c.ruta_id) (clientesPorRuta[c.ruta_id] ??= new Set()).add(c.id);

      const rutasDetalle = (rutas.data ?? []).map((r) => ({
        id: r.id,
        nombre: r.nombre,
        total: stats[r.id]?.total ?? 0,
        ventas: stats[r.id]?.n ?? 0,
        clientes: clientesPorRuta[r.id]?.size ?? 0,
      }));
      const porRuta = rutasDetalle.filter((r) => r.total > 0).map((r) => ({ nombre: r.nombre, total: r.total }));

      // Tendencias 14 días
      const dias = diasSerie(14);
      const ped = pedidos.data ?? [];
      const dev = devoluciones.data ?? [];
      const tendPedidos = dias.map((d) => ({
        label: d.label,
        valor: ped.filter((p) => new Date(p.created_at).toDateString() === d.key && p.estado !== "anulado").reduce((s, p) => s + Number(p.total), 0),
      }));
      const tendDevol = dias.map((d) => ({
        label: d.label,
        valor: dev.filter((x) => new Date(x.fecha).toDateString() === d.key).reduce((s, x) => s + Number(x.total), 0),
      }));
      const pedidosAbiertos = ped.filter((p) => ["borrador", "confirmado", "cargado"].includes(p.estado));
      const montoPreventa = pedidosAbiertos.reduce((s, p) => s + Number(p.total), 0);
      const entregados = ped.filter((p) => p.estado === "entregado").length;
      const lineas = dev.flatMap((d) => d.devoluciones_detalle ?? []);
      const valorL = (ls: typeof lineas) => ls.reduce((s, l) => s + Number(l.cantidad) * Number(l.precio_unitario), 0);
      const totalDev = valorL(lineas);
      const merma = valorL(lineas.filter((l) => l.destino === "merma"));

      return {
        hoy, mes, gastosHoy, gastosMes, creditoActivo, creditoVencido, topProductos, porRuta, rutasDetalle,
        tendPedidos, tendDevol,
        pedidosAbiertos: pedidosAbiertos.length, montoPreventa, entregados,
        totalDev, merma, nDev: dev.length,
      };
    },
  });

  return (
    <div>
      <PageHeader title="Dashboard Gerencial" subtitle="Resumen del mes" />
      <div className="space-y-4 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <Stat icon={Wallet} label="Ventas hoy" value={formatCRC(data?.hoy ?? 0)} to="/dashboard" />
          <Stat icon={TrendingUp} label="Ventas mes" value={formatCRC(data?.mes ?? 0)} tone="accent" to="/dashboard" />
          <Stat icon={Receipt} label="Gastos hoy" value={formatCRC(data?.gastosHoy ?? 0)} tone="destructive" to="/gastos" />
          <Stat icon={Receipt} label="Gastos mes" value={formatCRC(data?.gastosMes ?? 0)} tone="destructive" to="/gastos" />
          <Stat icon={CreditCard} label="Crédito activo" value={formatCRC(data?.creditoActivo ?? 0)} tone="warning" to="/cobranza" />
          <Stat icon={AlertTriangle} label="Crédito vencido" value={formatCRC(data?.creditoVencido ?? 0)} tone="destructive" to="/cobranza" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Link to="/productos" className="block">
            <Card className="p-4 transition-shadow hover:shadow-md">
              <h2 className="mb-3 font-bold">Productos más vendidos (mes)</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data?.topProductos ?? []} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis dataKey="nombre" type="category" width={90} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="cant" radius={[0, 4, 4, 0]}>
                    {(data?.topProductos ?? []).map((_, i) => (
                      <Cell key={i} fill={PALETA[i % PALETA.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Link>

          <Card className="p-4">
            <h2 className="mb-3 font-bold">Ventas por ruta (mes)</h2>
            {(data?.porRuta.length ?? 0) === 0 ? (
              <p className="py-20 text-center text-sm text-muted-foreground">Sin ventas este mes</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={data?.porRuta ?? []}
                    dataKey="total"
                    nameKey="nombre"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    label={({ percent }) => `${Math.round((percent ?? 0) * 100)}%`}
                  >
                    {(data?.porRuta ?? []).map((_, i) => (
                      <Cell key={i} fill={PALETA[i % PALETA.length]} stroke="var(--card)" />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCRC(v)} contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <TrendCard
            to="/pedidos"
            icon={ClipboardList}
            title="Preventas (14 días)"
            color="var(--chart-1)"
            id="tp"
            serie={data?.tendPedidos ?? []}
            kpis={[
              { label: "Pedidos abiertos", value: String(data?.pedidosAbiertos ?? 0) },
              { label: "Monto en preventa", value: formatCRC(data?.montoPreventa ?? 0) },
              { label: "Entregados", value: String(data?.entregados ?? 0) },
            ]}
          />
          <TrendCard
            to="/devoluciones"
            icon={Undo2}
            title="Devoluciones (14 días)"
            color="var(--chart-4)"
            id="td"
            serie={data?.tendDevol ?? []}
            kpis={[
              { label: "Devoluciones", value: String(data?.nDev ?? 0) },
              { label: "Valor devuelto", value: formatCRC(data?.totalDev ?? 0) },
              {
                label: "Merma",
                value: `${formatCRC(data?.merma ?? 0)} · ${data?.totalDev ? Math.round((data.merma / data.totalDev) * 100) : 0}%`,
              },
            ]}
          />
        </div>

        <div>
          <h2 className="mb-3 font-bold">Rutas de Distribución (mes)</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {(data?.rutasDetalle ?? []).map((r, i) => (
              <Card key={r.id} className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted" style={{ color: PALETA[i % PALETA.length] }}>
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

function TrendCard({
  to, icon: Icon, title, color, id, serie, kpis,
}: {
  to: string;
  icon: typeof Wallet;
  title: string;
  color: string;
  id: string;
  serie: { label: string; valor: number }[];
  kpis: { label: string; value: string }[];
}) {
  return (
    <Link to={to} className="block">
      <Card className="p-4 transition-shadow hover:shadow-md">
        <div className="mb-3 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-muted" style={{ color }}>
            <Icon className="h-5 w-5" />
          </div>
          <h2 className="font-bold">{title}</h2>
        </div>
        <div className="mb-2 grid grid-cols-3 gap-2">
          {kpis.map((k) => (
            <div key={k.label}>
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="truncate text-sm font-black">{k.value}</p>
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={110}>
          <AreaChart data={serie} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.5} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" hide />
            <Tooltip formatter={(v: number) => formatCRC(v)} contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="valor" stroke={color} strokeWidth={2.5} fill={`url(#${id})`} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </Link>
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
