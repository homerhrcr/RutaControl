import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRutas, useClientes, useInvalidate, guardarOrdenRuta } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { QuickSale } from "@/components/QuickSale";
import { AbonoDialog } from "@/components/AbonoDialog";
import { HistorialCliente } from "@/components/HistorialCliente";
import { EvidenciaButton } from "@/components/EvidenciaButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCRC } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Search,
  Zap,
  HandCoins,
  MapPin,
  ShoppingBag,
  Receipt,
  Wallet,
  Users,
  History,
  ArrowUp,
  ArrowDown,
  ListOrdered,
  Check,
  Navigation,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/ruta")({
  head: () => ({
    meta: [
      { title: "Iniciar Ruta — Ruta Directo" },
      { name: "description", content: "Ventas y cobros por cliente en las rutas de Ruta Directo." },
      { property: "og:title", content: "Iniciar Ruta — Ruta Directo" },
      { property: "og:description", content: "Ventas y cobros por cliente en las rutas de Ruta Directo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RutaPage,
});

function todayRouteName(): string {
  const d = new Date().getDay();
  if (d === 3) return "Ruta Miércoles";
  if (d === 6) return "Ruta Sábado";
  return "";
}

export function RutaPage() {
  const { user, nombre } = useAuth();
  const { data: rutas } = useRutas();
  const [rutaId, setRutaId] = useState<string | "all">("all");
  const [search, setSearch] = useState("");
  const [saleClient, setSaleClient] = useState<any | null>(null);
  const [abonoClient, setAbonoClient] = useState<any | null>(null);
  const [histClient, setHistClient] = useState<any | null>(null);
  const [ordenMode, setOrdenMode] = useState(false);
  const [orderList, setOrderList] = useState<any[] | null>(null);
  const [saving, setSaving] = useState(false);
  const invalidate = useInvalidate();

  const { data: clientes } = useClientes(rutaId === "all" ? undefined : rutaId);

  // saldos por cliente
  const { data: saldos } = useQuery({
    queryKey: ["saldos-map"],
    queryFn: async () => {
      const { data, error } = await supabase.from("creditos").select("cliente_id, saldo").gt("saldo", 0);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const c of data) if (c.cliente_id) map[c.cliente_id] = (map[c.cliente_id] ?? 0) + Number(c.saldo);
      return map;
    },
  });

  // clientes visitados hoy (ventas o abonos) — para sugerir el siguiente
  const { data: visitadosHoy } = useQuery({
    queryKey: ["visitados-hoy", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const [{ data: ventas }, { data: abonos }] = await Promise.all([
        supabase.from("ventas").select("cliente_id, fecha").gte("fecha", start.toISOString()),
        supabase.from("abonos").select("cliente_id, fecha").gte("fecha", start.toISOString()),
      ]);
      const ids: string[] = [];
      let lastTime = 0;
      let lastId = "";
      for (const v of [...(ventas ?? []), ...(abonos ?? [])]) {
        if (!v.cliente_id) continue;
        if (!ids.includes(v.cliente_id)) ids.push(v.cliente_id);
        const t = new Date(v.fecha as string).getTime();
        if (t > lastTime) {
          lastTime = t;
          lastId = v.cliente_id;
        }
      }
      // Devolvemos un arreglo (serializable) porque la caché se guarda en el
      // dispositivo para uso sin conexión; un Set se perdería al restaurarla.
      return { ids, lastId };
    },
  });

  const visitadosSet = useMemo(
    () => new Set<string>(Array.isArray(visitadosHoy?.ids) ? visitadosHoy!.ids : []),
    [visitadosHoy],
  );

  // resumen del día
  const { data: resumen } = useQuery({
    queryKey: ["resumen-dia", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const [{ data: ventas }, { data: abonos }, { data: gastos }] = await Promise.all([
        supabase.from("ventas").select("total, cliente_id, metodo_pago").eq("vendedor_id", user!.id).gte("fecha", start.toISOString()),
        supabase.from("abonos").select("monto").eq("cobrador_id", user!.id).gte("fecha", start.toISOString()),
        supabase.from("gastos").select("monto").gte("fecha", start.toISOString()),
      ]);
      const totalVentas = (ventas ?? []).reduce((s, v) => s + Number(v.total), 0);
      const credito = (ventas ?? []).filter((v) => v.metodo_pago === "credito").reduce((s, v) => s + Number(v.total), 0);
      const cobrado = (abonos ?? []).reduce((s, a) => s + Number(a.monto), 0);
      const gastosTotal = (gastos ?? []).reduce((s, g) => s + Number(g.monto), 0);
      const visitados = new Set((ventas ?? []).map((v) => v.cliente_id)).size;
      return { totalVentas, credito, cobrado, gastosTotal, visitados };
    },
  });

  const today = todayRouteName();

  // orden de entrega del cliente dentro de la ruta seleccionada
  function ordenDe(c: any): number {
    const cr = (c.cliente_rutas ?? []).find((x: any) => x.ruta_id === rutaId) ?? (c.cliente_rutas ?? [])[0];
    return cr?.orden ?? 9999;
  }

  // lista ordenada por orden de entrega (cuando hay ruta) o por nombre
  const ordenados = useMemo(() => {
    const arr = [...(clientes ?? [])];
    if (rutaId !== "all") arr.sort((a, b) => ordenDe(a) - ordenDe(b));
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes, rutaId]);

  const filtered = useMemo(
    () => ordenados.filter((c) => c.nombre.toLowerCase().includes(search.toLowerCase())),
    [ordenados, search],
  );

  // siguiente cliente sugerido: el primero (por orden) que no se ha visitado hoy
  const siguienteId = useMemo(() => {
    if (rutaId === "all") return "";
    const pendiente = ordenados.find((c) => !visitadosSet.has(c.id));
    return pendiente?.id ?? "";
  }, [ordenados, visitadosSet, rutaId]);

  function onSaleDone() {
    invalidate(["saldos-map", "resumen-dia", "visitados-hoy", "ventas-cliente", "creditos-pendientes"]);
  }

  function startOrden() {
    setOrderList([...ordenados]);
    setOrdenMode(true);
  }

  function moveItem(idx: number, dir: -1 | 1) {
    setOrderList((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  async function saveOrden() {
    if (!orderList) return;
    setSaving(true);
    try {
      const items = orderList
        .map((c, i) => {
          const cr = (c.cliente_rutas ?? []).find((x: any) => x.ruta_id === rutaId) ?? (c.cliente_rutas ?? [])[0];
          return cr?.id ? { id: cr.id, orden: i + 1 } : null;
        })
        .filter(Boolean) as { id: string; orden: number }[];
      await guardarOrdenRuta(items);
      toast.success("Orden de entrega guardado");
      setOrdenMode(false);
      setOrderList(null);
      invalidate(["clientes"]);
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo guardar el orden");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Iniciar Ruta" subtitle={today ? `Hoy: ${today}` : `Vendedor: ${nombre}`} />

      <div className="space-y-4 p-4 md:p-6">
        {/* resumen */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard icon={ShoppingBag} label="Ventas hoy" value={formatCRC(resumen?.totalVentas ?? 0)} />
          <StatCard icon={Wallet} label="Cobrado hoy" value={formatCRC(resumen?.cobrado ?? 0)} tone="accent" />
          <StatCard icon={HandCoins} label="Crédito hoy" value={formatCRC(resumen?.credito ?? 0)} tone="warning" />
          <StatCard icon={Receipt} label="Gastos hoy" value={formatCRC(resumen?.gastosTotal ?? 0)} tone="destructive" />
          <StatCard icon={Users} label="Clientes visitados" value={String(resumen?.visitados ?? 0)} />
        </div>

        {/* route tabs */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={rutaId === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setRutaId("all");
              setOrdenMode(false);
              setOrderList(null);
            }}
          >
            Todos
          </Button>
          {rutas?.map((r) => (
            <Button
              key={r.id}
              variant={rutaId === r.id ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setRutaId(r.id);
                setOrdenMode(false);
                setOrderList(null);
              }}
            >
              {r.nombre}
            </Button>
          ))}
        </div>

        {/* control de orden de entrega (solo en una ruta) */}
        {rutaId !== "all" && (
          <div className="flex flex-wrap items-center gap-2">
            {!ordenMode ? (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={startOrden}>
                <ListOrdered className="h-4 w-4" /> Ordenar entrega
              </Button>
            ) : (
              <>
                <Button size="sm" className="gap-1.5" disabled={saving} onClick={saveOrden}>
                  <Check className="h-4 w-4" /> Guardar orden
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() => {
                    setOrdenMode(false);
                    setOrderList(null);
                  }}
                >
                  Cancelar
                </Button>
                <span className="text-xs text-muted-foreground">Usa las flechas para reordenar</span>
              </>
            )}
          </div>
        )}

        {/* siguiente cliente sugerido */}
        {!ordenMode && rutaId !== "all" && siguienteId && (
          <div className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-2 py-1 text-xs">
            <Navigation className="h-3 w-3 shrink-0 text-primary" />
            <span className="shrink-0 font-medium">Siguiente:</span>
            <span className="truncate font-bold">{ordenados.find((c) => c.id === siguienteId)?.nombre}</span>
          </div>
        )}

        {!ordenMode && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar cliente…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        )}

        {/* modo ordenar */}
        {ordenMode && orderList && (
          <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
            {orderList.map((c, idx) => (
              <Card key={c.id} className="flex items-center gap-1.5 p-1.5">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold leading-tight">{c.nombre}</p>
                  <p className="truncate text-[11px] leading-tight text-muted-foreground">{c.distrito || c.direccion || "Sin dirección"}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => moveItem(idx, -1)} aria-label="Subir">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={idx === orderList.length - 1}
                    onClick={() => moveItem(idx, 1)}
                    aria-label="Bajar"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {!ordenMode && (
          <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c, idx) => {
              const saldo = saldos?.[c.id] ?? 0;
              const visitado = visitadosSet.has(c.id);
              const esSiguiente = c.id === siguienteId;
              const rutasDe = Array.from(
                new Set(
                  ((c.cliente_rutas ?? []) as any[])
                    .map((cr) => cr.rutas?.nombre as string | undefined)
                    .filter((n): n is string => !!n),
                ),
              );
              return (
                <Card
                  key={c.id}
                  className={cn(
                    "p-1.5",
                    esSiguiente && "border-primary ring-1 ring-primary",
                    visitado && "opacity-60",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {rutaId !== "all" && (
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                        {idx + 1}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 text-sm font-semibold leading-tight">
                        {esSiguiente && <Navigation className="h-3 w-3 shrink-0 text-primary" />}
                        <span className="truncate">{c.nombre}</span>
                        {visitado && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-accent" />}
                      </p>
                      <p className="flex items-center gap-1 overflow-hidden text-[11px] leading-tight text-muted-foreground">
                        <MapPin className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{c.distrito || c.direccion || "Sin dirección"}</span>
                        {saldo > 0 && (
                          <span className="shrink-0 rounded bg-destructive/15 px-1 text-[10px] font-bold text-destructive">
                            {formatCRC(saldo)}
                          </span>
                        )}
                        {rutasDe.length > 0 && (
                          <span className="hidden truncate font-medium sm:inline">
                            · {rutasDe.map((n) => n.replace("Ruta ", "")).join(" · ")}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={() => setSaleClient(c)} title="Vender">
                        <Zap className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Vender</span>
                      </Button>
                      <Button
                        size="icon"
                        variant={saldo > 0 ? "secondary" : "outline"}
                        className={cn("h-7 w-7", saldo === 0 && "opacity-50")}
                        disabled={saldo === 0}
                        onClick={() => setAbonoClient(c)}
                        title="Abonar"
                        aria-label="Abonar"
                      >
                        <HandCoins className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7"
                        onClick={() => setHistClient(c)}
                        title="Historial"
                        aria-label="Historial"
                      >
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      <EvidenciaButton entidad="clientes" entidadId={c.id} compact />
                    </div>
                  </div>
                </Card>
              );
            })}
            {filtered.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">No hay clientes en esta ruta.</p>
            )}
          </div>
        )}
      </div>

      <QuickSale cliente={saleClient} open={!!saleClient} onClose={() => setSaleClient(null)} onDone={onSaleDone} />
      <AbonoDialog cliente={abonoClient} open={!!abonoClient} onClose={() => setAbonoClient(null)} onDone={onSaleDone} />
      <HistorialCliente cliente={histClient} open={!!histClient} onClose={() => setHistClient(null)} />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "primary",
}: {
  icon: typeof ShoppingBag;
  label: string;
  value: string;
  tone?: "primary" | "accent" | "warning" | "destructive";
}) {
  const toneClass =
    tone === "accent" ? "bg-accent/15 text-accent" : tone === "warning" ? "bg-warning/20 text-warning" : tone === "destructive" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary";
  return (
    <Card className="p-3">
      <div className={cn("mb-2 grid h-9 w-9 place-items-center rounded-lg", toneClass)}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-lg font-black">{value}</p>
    </Card>
  );
}
