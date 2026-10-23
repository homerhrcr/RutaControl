import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useRutas, useInvalidate } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { AbonoDialog } from "@/components/AbonoDialog";
import { HistorialCliente } from "@/components/HistorialCliente";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatCRC, formatDate, daysBetween, agingBucket } from "@/lib/format";
import { Search, HandCoins, AlertTriangle, Receipt, Plus } from "lucide-react";
import { SaldoHistoricoDialog } from "@/components/SaldoHistoricoDialog";
import { TelegramEnviar } from "@/components/TelegramCliente";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useEmpresa } from "@/lib/empresa";
import { creditosDeRuta, rutaDeCredito } from "@/lib/cobranza-rutas";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cobranza")({
  head: () => ({
    meta: [
      { title: "Crédito y Cobros por Ruta — Ruta Directo" },
      { name: "description", content: "Saldos, deudas de clientes y abonos separados por ruta." },
      { property: "og:title", content: "Crédito y Cobros por Ruta — Ruta Directo" },
      { property: "og:description", content: "Saldos, deudas de clientes y abonos separados por ruta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CobranzaPage,
});

type ClienteCobro = { id: string; nombre: string; telefono?: string | null; creditoIds: string[] };

export function CobranzaPage() {
  const { data: rutas } = useRutas();
  const { data: empresa } = useEmpresa();
  const { isAdmin } = useAuth();
  const invalidate = useInvalidate();
  const { data: creditos, isPending, error } = useQuery({
    queryKey: ["creditos-pendientes", "por-ruta"],
    queryFn: async () => {
      const { data, error } = await supabase.from("creditos")
        .select("*, clientes(nombre, telefono, ruta_id, cliente_rutas(ruta_id)), ventas(ruta_id), abonos(id, fecha, monto)")
        .gt("saldo", 0).order("fecha_limite");
      if (error) throw error;
      return data ?? [];
    },
  });
  const [rutaId, setRutaId] = useState("");
  const [abonoClient, setAbonoClient] = useState<ClienteCobro | null>(null);
  const [historialClient, setHistorialClient] = useState<ClienteCobro | null>(null);
  const [q, setQ] = useState("");
  const [montos, setMontos] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [saldoHist, setSaldoHist] = useState<{ cliente: { id: string; nombre: string } | null } | null>(null);
  const opciones = (rutas ?? []).map((r) => ({ id: r.id, nombre: r.nombre }));
  for (const c of creditos ?? []) {
    const id = rutaDeCredito(c);
    if (!opciones.some((r) => r.id === id)) opciones.push({ id, nombre: "Sin ruta asignada" });
  }
  const rutasReales = opciones.filter((r) => r.id !== "sin-ruta");
  opciones.unshift({ id: "todas", nombre: "Todas las rutas" });
  const seleccion = opciones.some((r) => r.id === rutaId) ? rutaId : "todas";
  const nombreRuta = opciones.find((r) => r.id === seleccion)?.nombre ?? "";
  const deRuta = seleccion === "todas" ? (creditos ?? []) : creditosDeRuta(creditos ?? [], seleccion);
  const globales = deRuta.filter((c) => !c.cliente_id);
  const map = new Map<string, { cliente: ClienteCobro; saldo: number; vence: string | null }>();
  for (const c of deRuta) {
    const cl = c.clientes;
    if (!c.cliente_id || !cl) continue;
    const prev = map.get(c.cliente_id);
    const vence = [prev?.vence, c.fecha_limite].filter((v): v is string => !!v).sort()[0] ?? null;
    map.set(c.cliente_id, {
      cliente: { id: c.cliente_id, nombre: cl.nombre, telefono: cl.telefono, creditoIds: [...(prev?.cliente.creditoIds ?? []), c.id] },
      saldo: (prev?.saldo ?? 0) + Number(c.saldo), vence,
    });
  }
  const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const rows = [...map.values()].sort((a, b) => b.saldo - a.saldo)
    .filter((r) => norm(`${r.cliente.nombre} ${r.cliente.telefono ?? ""}`).includes(norm(q.trim())));
  const total = deRuta.reduce((s, c) => s + Number(c.saldo), 0);
  const buckets: Record<string, number> = { "0-30 días": 0, "31-60 días": 0, "61-90 días": 0, "+90 días": 0 };
  for (const c of deRuta) buckets[agingBucket(daysBetween(c.fecha))] += Number(c.saldo);
  const actualizar = () => invalidate(["creditos-pendientes", "creditos-ruta", "creditos-cliente", "creditos-cliente-detalle", "abonos-cliente", "saldos-map", "resumen-dia"]);

  async function abonarRuta(id: string, saldo: number) {
    const m = montos[id] ?? 0;
    if (!Number.isFinite(m) || m <= 0 || m > saldo) return toast.error("El abono debe ser mayor a cero y no superar el saldo");
    setBusy(id);
    try {
      const { error } = await supabase.rpc("abonar_credito_ruta", { p: { id: crypto.randomUUID(), credito_id: id, monto: m } });
      if (error) throw error;
      toast.success(`Abono registrado · ${formatCRC(m)}`);
      setMontos((s) => ({ ...s, [id]: 0 }));
      actualizar();
    } catch (e: any) { toast.error(e.message ?? "No se pudo registrar el abono"); }
    finally { setBusy(null); }
  }

  return (
    <div>
      <PageHeader title="Crédito y Cobros" subtitle={nombreRuta ? `${nombreRuta} · Pendiente: ${formatCRC(total)}` : "Por ruta"} />
      <div className="space-y-4 p-4 md:p-6">
        <div className="max-w-md space-y-1.5">
          <Label htmlFor="ruta-cobranza">Ruta</Label>
          <Select value={seleccion} onValueChange={(id) => { setRutaId(id); setQ(""); setMontos({}); setAbonoClient(null); setHistorialClient(null); }}>
            <SelectTrigger id="ruta-cobranza" className="h-11"><SelectValue placeholder="Seleccionar ruta" /></SelectTrigger>
            <SelectContent>{opciones.map((r) => <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {isPending && <p className="text-sm text-muted-foreground">Cargando saldos…</p>}
        {error && <p role="alert" className="text-sm text-destructive">No se pudieron cargar los saldos. <Button variant="outline" size="sm" onClick={actualizar}>Reintentar</Button></p>}
        {!isPending && !error && <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Object.entries(buckets).map(([k, v]) => <Card key={k} className="p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="truncate text-lg font-black">{formatCRC(v)}</p></Card>)}
          </div>
          {globales.length > 0 && <section className="space-y-2">
            <h2 className="font-semibold">Crédito de cierre global · {nombreRuta}</h2>
            {globales.map((c) => <Card key={c.id} className="space-y-2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>Cierre del {formatDate(c.fecha)}</span><span className="font-black text-destructive">{formatCRC(c.saldo)}</span></div>
              {(c.abonos ?? []).map((a) => <p key={a.id} className="text-xs text-muted-foreground">Abono {formatDate(a.fecha)} · {formatCRC(a.monto)}</p>)}
              {isAdmin && <div className="flex gap-2"><Input aria-label={`Monto de abono ${formatDate(c.fecha)}`} type="number" inputMode="numeric" className="h-11 min-w-0 flex-1" placeholder="₡0" value={montos[c.id] || ""} onChange={(e) => setMontos((s) => ({ ...s, [c.id]: Number(e.target.value) || 0 }))} /><Button disabled={busy !== null} onClick={() => abonarRuta(c.id, Number(c.saldo))}><HandCoins className="mr-1.5 h-4 w-4" />Abonar</Button></div>}
            </Card>)}
          </section>}
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Deudas de clientes · {nombreRuta}</h2>{isAdmin && <Button variant="outline" className="h-11 gap-1.5" onClick={() => setSaldoHist({ cliente: null })}><Plus className="h-4 w-4" />Saldo histórico</Button>}</div>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-11 pl-9" placeholder="Buscar cliente o teléfono…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="space-y-2.5">
            {rows.map((r) => <Card key={r.cliente.id} className="p-3">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-semibold">{r.cliente.nombre}</p><p className="text-xs text-muted-foreground">Vence: {formatDate(r.vence)}</p>{r.vence && daysBetween(r.vence, new Date()) > 0 && <Badge variant="outline" className="mt-1 border-destructive/40 text-destructive"><AlertTriangle className="mr-1 h-3 w-3" />Vencido</Badge>}</div><p className="shrink-0 text-lg font-black text-destructive">{formatCRC(r.saldo)}</p></div>
              <div className="mt-3 flex flex-wrap gap-2"><Button className="h-11 flex-1 gap-1.5" onClick={() => setAbonoClient(r.cliente)}><HandCoins className="h-4 w-4" />Registrar abono</Button>{isAdmin && <Button variant="outline" className="h-11 gap-1.5" onClick={() => setSaldoHist({ cliente: r.cliente })}><Plus className="h-4 w-4" />Saldo histórico</Button>}<Button variant="outline" className="h-11 flex-1 gap-1.5" onClick={() => setHistorialClient(r.cliente)}><Receipt className="h-4 w-4" />Ver detalle de deuda</Button><TelegramEnviar iconOnly clienteId={r.cliente.id} texto={`Hola ${r.cliente.nombre}, le recordamos su saldo pendiente de ${formatCRC(r.saldo)} de ${nombreRuta}${empresa?.nombre ? ` con ${empresa.nombre}` : ""}.`} /></div>
            </Card>)}
            {rows.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{q ? "Ningún cliente coincide en esta ruta" : "Sin deudas de clientes pendientes en esta ruta"}</p>}
          </div>
        </>}
      </div>
      <AbonoDialog cliente={abonoClient} creditoIds={abonoClient?.creditoIds} rutaNombre={nombreRuta} open={!!abonoClient} onClose={() => setAbonoClient(null)} onDone={actualizar} />
      <HistorialCliente cliente={historialClient} creditoIds={historialClient?.creditoIds} rutaNombre={nombreRuta} open={!!historialClient} soloDeuda onClose={() => setHistorialClient(null)} />
      <SaldoHistoricoDialog open={!!saldoHist} clienteInicial={saldoHist?.cliente} rutaId={seleccion === "todas" ? "" : seleccion} rutaNombre={nombreRuta} rutasOpciones={seleccion === "todas" ? rutasReales : undefined} onClose={() => setSaldoHist(null)} onDone={actualizar} />
    </div>
  );
}
