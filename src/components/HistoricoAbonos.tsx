import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRutas } from "@/lib/data";
import { formatCRC } from "@/lib/format";
import { desglosarMedio } from "@/lib/pago-mixto";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Histórico de todos los abonos de clientes, con filtros por fecha, ruta y texto. */
export function HistoricoAbonos() {
  const { data: rutas } = useRutas();
  const hoy = new Date();
  const [desde, setDesde] = useState(iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)));
  const [hasta, setHasta] = useState(iso(hoy));
  const [ruta, setRuta] = useState("todas");
  const [q, setQ] = useState("");

  const { data, isPending, error } = useQuery({
    queryKey: ["abonos-historico", desde, hasta],
    queryFn: async () => {
      const a = new Date(`${desde}T00:00:00`).toISOString();
      const b = new Date(`${hasta}T23:59:59.999`).toISOString();
      const [ab, pf] = await Promise.all([
        supabase.from("abonos").select("id,fecha,monto,medio_pago,referencia_pago,cobrador_id,cliente_id,clientes(nombre),creditos(ruta_id,cliente_id,ventas(ruta_id))")
          .gte("fecha", a).lte("fecha", b).order("fecha", { ascending: false }).limit(2000),
        supabase.from("profiles").select("id,nombre"),
      ]);
      if (ab.error) throw ab.error;
      const nom = new Map((pf.data ?? []).map((p) => [p.id, p.nombre]));
      return (ab.data ?? []).map((x: any) => ({
        ...x, rutaId: x.creditos?.ruta_id ?? x.creditos?.ventas?.ruta_id ?? null,
        cobrador: x.cobrador_id ? nom.get(x.cobrador_id) ?? "" : "",
      }));
    },
  });

  const rutaNom = new Map((rutas ?? []).map((r) => [r.id, r.nombre]));
  const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filas = useMemo(() => (data ?? []).filter((x) => (ruta === "todas" || x.rutaId === ruta)
    && norm(`${x.clientes?.nombre ?? ""} ${x.referencia_pago ?? ""} ${x.medio_pago ?? ""}`).includes(norm(q.trim()))), [data, ruta, q]);
  const total = filas.reduce((s, x) => s + Number(x.monto), 0);
  let efectivo = 0, electronico = 0;
  for (const x of filas) { const d = desglosarMedio(x.medio_pago, Number(x.monto)); efectivo += d.efectivo; electronico += d.electronico; }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1"><Label htmlFor="ha-desde">Desde</Label><Input id="ha-desde" type="date" className="h-11" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="ha-hasta">Hasta</Label><Input id="ha-hasta" type="date" className="h-11" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="ha-ruta">Ruta</Label>
          <Select value={ruta} onValueChange={setRuta}><SelectTrigger id="ha-ruta" className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="todas">Todas las rutas</SelectItem>{(rutas ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>)}</SelectContent>
          </Select></div>
      </div>
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-11 pl-9" placeholder="Buscar cliente, referencia o forma de pago…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([["Total cobrado", formatCRC(total)], ["Efectivo", formatCRC(efectivo)], ["SINPE / transferencia", formatCRC(electronico)], ["Abonos", String(filas.length)]] as const).map(([l, v]) =>
          <Card key={l} className="p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="truncate text-lg font-black">{v}</p></Card>)}
      </div>
      {isPending && <p className="text-sm text-muted-foreground">Cargando abonos…</p>}
      {error && <p role="alert" className="text-sm text-destructive">No se pudieron cargar los abonos.</p>}
      <div className="space-y-2">
        {filas.map((x) => <Card key={x.id} className="p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 text-sm">
              <p className="break-words font-semibold">{x.clientes?.nombre ?? `${rutaNom.get(x.rutaId) ?? "Ruta"} (cierre global)`}</p>
              <p className="text-xs text-muted-foreground">{new Date(x.fecha).toLocaleString("es-CR", { dateStyle: "medium", timeStyle: "short" })} · {rutaNom.get(x.rutaId) ?? "Sin ruta"}</p>
              <p className="text-xs text-muted-foreground">{x.medio_pago || "Efectivo"}{x.referencia_pago ? ` · Ref. ${x.referencia_pago}` : ""}{x.cobrador ? ` · Cobró: ${x.cobrador}` : ""}</p>
            </div>
            <p className="shrink-0 text-lg font-black text-success">{formatCRC(Number(x.monto))}</p>
          </div>
        </Card>)}
        {!isPending && filas.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Sin abonos en este período</p>}
      </div>
    </div>
  );
}
