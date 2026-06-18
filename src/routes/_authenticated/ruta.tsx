import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRutas, useClientes, useInvalidate } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { QuickSale } from "@/components/QuickSale";
import { AbonoDialog } from "@/components/AbonoDialog";
import { HistorialCliente } from "@/components/HistorialCliente";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCRC } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Search, Zap, HandCoins, MapPin, ShoppingBag, Wallet, Users, History } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ruta")({
  component: RutaPage,
});

function todayRouteName(): string {
  const d = new Date().getDay();
  if (d === 3) return "Ruta Miércoles";
  if (d === 6) return "Ruta Sábado";
  return "";
}

function RutaPage() {
  const { user, nombre } = useAuth();
  const { data: rutas } = useRutas();
  const [rutaId, setRutaId] = useState<string | "all">("all");
  const [search, setSearch] = useState("");
  const [saleClient, setSaleClient] = useState<any | null>(null);
  const [abonoClient, setAbonoClient] = useState<any | null>(null);
  const [histClient, setHistClient] = useState<any | null>(null);
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

  // resumen del día
  const { data: resumen } = useQuery({
    queryKey: ["resumen-dia", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const [{ data: ventas }, { data: abonos }] = await Promise.all([
        supabase.from("ventas").select("total, cliente_id, metodo_pago").eq("vendedor_id", user!.id).gte("fecha", start.toISOString()),
        supabase.from("abonos").select("monto").eq("cobrador_id", user!.id).gte("fecha", start.toISOString()),
      ]);
      const totalVentas = (ventas ?? []).reduce((s, v) => s + Number(v.total), 0);
      const credito = (ventas ?? []).filter((v) => v.metodo_pago === "credito").reduce((s, v) => s + Number(v.total), 0);
      const cobrado = (abonos ?? []).reduce((s, a) => s + Number(a.monto), 0);
      const visitados = new Set((ventas ?? []).map((v) => v.cliente_id)).size;
      return { totalVentas, credito, cobrado, visitados };
    },
  });

  const today = todayRouteName();
  const filtered = useMemo(
    () => (clientes ?? []).filter((c) => c.nombre.toLowerCase().includes(search.toLowerCase())),
    [clientes, search],
  );

  function onSaleDone() {
    invalidate(["saldos-map", "resumen-dia", "ventas-cliente", "creditos-pendientes"]);
  }

  return (
    <div>
      <PageHeader title="Ruta del día" subtitle={today ? `Hoy: ${today}` : `Vendedor: ${nombre}`} />

      <div className="space-y-4 p-4 md:p-6">
        {/* resumen */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={ShoppingBag} label="Ventas hoy" value={formatCRC(resumen?.totalVentas ?? 0)} />
          <StatCard icon={Wallet} label="Cobrado hoy" value={formatCRC(resumen?.cobrado ?? 0)} tone="accent" />
          <StatCard icon={HandCoins} label="Crédito hoy" value={formatCRC(resumen?.credito ?? 0)} tone="warning" />
          <StatCard icon={Users} label="Clientes visitados" value={String(resumen?.visitados ?? 0)} />
        </div>

        {/* route tabs */}
        <div className="flex flex-wrap gap-2">
          <Button variant={rutaId === "all" ? "default" : "outline"} size="sm" onClick={() => setRutaId("all")}>
            Todos
          </Button>
          {rutas?.map((r) => (
            <Button
              key={r.id}
              variant={rutaId === r.id ? "default" : "outline"}
              size="sm"
              onClick={() => setRutaId(r.id)}
            >
              {r.nombre}
            </Button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar cliente…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="space-y-2.5">
          {filtered.map((c) => {
            const saldo = saldos?.[c.id] ?? 0;
            return (
              <Card key={c.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.nombre}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" /> {c.distrito || c.direccion || "Sin dirección"}
                    </p>
                    {saldo > 0 && (
                      <Badge variant="outline" className="mt-1.5 border-destructive/40 text-destructive">
                        Saldo: {formatCRC(saldo)}
                      </Badge>
                    )}
                  </div>
                  {(c as any).rutas?.nombre && (
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {(c as any).rutas.nombre.replace("Ruta ", "")}
                    </Badge>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button className="h-11 gap-1.5" onClick={() => setSaleClient(c)}>
                    <Zap className="h-4 w-4" /> Vender
                  </Button>
                  <Button
                    variant={saldo > 0 ? "secondary" : "outline"}
                    className={cn("h-11 gap-1.5", saldo === 0 && "opacity-60")}
                    disabled={saldo === 0}
                    onClick={() => setAbonoClient(c)}
                  >
                    <HandCoins className="h-4 w-4" /> Abonar
                  </Button>
                  <Button
                    variant="outline"
                    className="col-span-2 h-11 gap-1.5"
                    onClick={() => setHistClient(c)}
                  >
                    <History className="h-4 w-4" /> Historial
                  </Button>
                </div>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No hay clientes en esta ruta.</p>
          )}
        </div>
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
  tone?: "primary" | "accent" | "warning";
}) {
  const toneClass =
    tone === "accent" ? "bg-accent/15 text-accent" : tone === "warning" ? "bg-warning/20 text-warning" : "bg-primary/15 text-primary";
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
