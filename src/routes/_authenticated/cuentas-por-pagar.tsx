import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCRC } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Receipt, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cuentas-por-pagar")({
  head: () => ({
    meta: [
      { title: "Cuentas por pagar — Ruta Directo" },
      { name: "description", content: "Compras a proveedores, abonos e histórico de cuentas canceladas." },
      { property: "og:title", content: "Cuentas por pagar — Ruta Directo" },
      { property: "og:description", content: "Compras a proveedores, abonos e histórico de cuentas canceladas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CuentasPorPagarPage,
});

type Pago = { id: string; fecha: string; monto: number; medio_pago: string | null; referencia: string | null };
type Cuenta = {
  id: string; fecha: string; proveedor: string; producto: string; cantidad: number; unidad: string;
  monto: number; pagado: number; estado: string; notas: string | null; cancelada_en: string | null;
  pagos_cuentas_por_pagar: Pago[];
};

const UNIDADES = ["unidad", "kg", "g", "litro", "caja", "paquete", "saco", "quintal", "galón"];
const MEDIOS = ["Efectivo", "SINPE Móvil", "Transferencia bancaria", "Tarjeta", "Cheque"];

function hoy() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
const r2 = (n: number) => Math.round(n * 100) / 100;
const fFecha = (s: string) => new Date(s.slice(0, 10) + "T12:00:00").toLocaleDateString("es-CR");

function CuentasPorPagarPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pendientes" | "historico">("pendientes");
  const [buscar, setBuscar] = useState("");
  const [nueva, setNueva] = useState(false);
  const [pagando, setPagando] = useState<Cuenta | null>(null);
  const [detalle, setDetalle] = useState<Cuenta | null>(null);

  const { data: cuentas = [] } = useQuery({
    queryKey: ["cuentas_por_pagar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cuentas_por_pagar")
        .select("*, pagos_cuentas_por_pagar(id, fecha, monto, medio_pago, referencia)")
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Cuenta[];
    },
  });
  const refrescar = () => qc.invalidateQueries({ queryKey: ["cuentas_por_pagar"] });

  const pendientes = cuentas.filter((c) => c.estado !== "cancelado");
  const historico = cuentas.filter((c) => c.estado === "cancelado");
  const mes = hoy().slice(0, 7);
  const kpi = useMemo(() => ({
    saldo: pendientes.reduce((s, c) => s + Number(c.monto) - Number(c.pagado), 0),
    pagadoMes: cuentas.flatMap((c) => c.pagos_cuentas_por_pagar ?? []).filter((p) => p.fecha.startsWith(mes)).reduce((s, p) => s + Number(p.monto), 0),
  }), [cuentas, pendientes, mes]);

  const q = buscar.trim().toLowerCase();
  const lista = (tab === "pendientes" ? pendientes : historico).filter(
    (c) => !q || c.proveedor.toLowerCase().includes(q) || c.producto.toLowerCase().includes(q),
  );
  const proveedores = Array.from(new Set(cuentas.map((c) => c.proveedor))).sort();

  return (
    <div className="space-y-4">
      <PageHeader title="Cuentas por pagar" subtitle="Compras a proveedores y sus pagos" />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-sm text-muted-foreground">Total pendiente de pago</p><p className="text-2xl font-bold text-destructive">{formatCRC(kpi.saldo)}</p></Card>
        <Card className="p-4"><p className="text-sm text-muted-foreground">Cuentas pendientes</p><p className="text-2xl font-bold">{pendientes.length}</p></Card>
        <Card className="p-4"><p className="text-sm text-muted-foreground">Pagado este mes</p><p className="text-2xl font-bold">{formatCRC(kpi.pagadoMes)}</p></Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="pendientes">Pendientes ({pendientes.length})</TabsTrigger>
            <TabsTrigger value="historico">Histórico ({historico.length})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar proveedor o producto" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        </div>
        <Button onClick={() => setNueva(true)}><Plus className="mr-1 h-4 w-4" />Registrar cuenta</Button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-2">Fecha</th><th className="p-2">Proveedor</th><th className="p-2">Producto</th>
              <th className="p-2 text-right">Cantidad</th><th className="p-2 text-right">Monto</th>
              <th className="p-2 text-right">Pagado</th><th className="p-2 text-right">Saldo</th><th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">
                {tab === "pendientes" ? "No hay cuentas pendientes" : "No hay cuentas canceladas"}
              </td></tr>
            )}
            {lista.map((c) => {
              const saldo = r2(Number(c.monto) - Number(c.pagado));
              return (
                <tr key={c.id} className="border-t">
                  <td className="p-2 whitespace-nowrap">{fFecha(c.fecha)}</td>
                  <td className="p-2 font-medium">{c.proveedor}</td>
                  <td className="p-2">{c.producto}</td>
                  <td className="p-2 text-right whitespace-nowrap">{Number(c.cantidad).toLocaleString("es-CR")} {c.unidad}</td>
                  <td className="p-2 text-right">{formatCRC(Number(c.monto))}</td>
                  <td className="p-2 text-right">{formatCRC(Number(c.pagado))}</td>
                  <td className="p-2 text-right font-semibold">{tab === "historico" ? "Cancelado" : formatCRC(saldo)}</td>
                  <td className="p-2 text-right whitespace-nowrap space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => setDetalle(c)}><Receipt className="h-4 w-4" /></Button>
                    {tab === "pendientes" && <Button size="sm" onClick={() => setPagando(c)}>Abonar / Cancelar</Button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {nueva && <NuevaCuenta proveedores={proveedores} onClose={() => setNueva(false)} onSaved={refrescar} />}
      {pagando && <PagoDialog cuenta={pagando} onClose={() => setPagando(null)} onSaved={refrescar} />}
      <Dialog open={!!detalle} onOpenChange={(o) => !o && setDetalle(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pagos · {detalle?.proveedor}</DialogTitle></DialogHeader>
          {detalle && (
            <div className="space-y-2 text-sm">
              <p>{detalle.producto} — {Number(detalle.cantidad).toLocaleString("es-CR")} {detalle.unidad} · {formatCRC(Number(detalle.monto))}</p>
              {detalle.notas && <p className="text-muted-foreground">{detalle.notas}</p>}
              {(detalle.pagos_cuentas_por_pagar ?? []).length === 0 ? <p className="text-muted-foreground">Sin pagos registrados.</p> :
                [...detalle.pagos_cuentas_por_pagar].sort((a, b) => a.fecha.localeCompare(b.fecha)).map((p) => (
                  <div key={p.id} className="flex justify-between border-t pt-2">
                    <span>{fFecha(p.fecha)} · {p.medio_pago ?? "—"}{p.referencia ? ` · Ref. ${p.referencia}` : ""}</span>
                    <span className="font-medium">{formatCRC(Number(p.monto))}</span>
                  </div>
                ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NuevaCuenta({ proveedores, onClose, onSaved }: { proveedores: string[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ fecha: hoy(), proveedor: "", producto: "", cantidad: "1", unidad: "unidad", monto: "", notas: "" });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function guardar() {
    const cantidad = Number(f.cantidad.replace(",", "."));
    const monto = Number(f.monto.replace(",", "."));
    if (!f.proveedor.trim() || !f.producto.trim()) return toast.error("Indique proveedor y producto");
    if (!(cantidad > 0) || !(monto > 0)) return toast.error("Cantidad y monto deben ser mayores a cero");
    setSaving(true);
    const { error } = await supabase.from("cuentas_por_pagar").insert({
      fecha: f.fecha, proveedor: f.proveedor.trim(), producto: f.producto.trim(), cantidad, unidad: f.unidad, monto: r2(monto), notas: f.notas.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Cuenta por pagar registrada");
    onSaved(); onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar cuenta por pagar</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>Fecha de compra</Label><Input type="date" value={f.fecha} onChange={set("fecha")} /></div>
          <div className="space-y-1"><Label>Proveedor</Label><Input list="cxp-proveedores" value={f.proveedor} onChange={set("proveedor")} />
            <datalist id="cxp-proveedores">{proveedores.map((p) => <option key={p} value={p} />)}</datalist></div>
          <div className="space-y-1 sm:col-span-2"><Label>Producto</Label><Input value={f.producto} onChange={set("producto")} /></div>
          <div className="space-y-1"><Label>Cantidad</Label><Input inputMode="decimal" value={f.cantidad} onChange={set("cantidad")} /></div>
          <div className="space-y-1"><Label>Unidad de medida</Label><Input list="cxp-unidades" value={f.unidad} onChange={set("unidad")} />
            <datalist id="cxp-unidades">{UNIDADES.map((u) => <option key={u} value={u} />)}</datalist></div>
          <div className="space-y-1 sm:col-span-2"><Label>Monto total (₡)</Label><Input inputMode="decimal" value={f.monto} onChange={set("monto")} /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Notas / N.º de factura (opcional)</Label><Textarea rows={2} value={f.notas} onChange={set("notas")} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={saving} onClick={guardar}>Guardar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PagoDialog({ cuenta, onClose, onSaved }: { cuenta: Cuenta; onClose: () => void; onSaved: () => void }) {
  const saldo = r2(Number(cuenta.monto) - Number(cuenta.pagado));
  const [monto, setMonto] = useState(String(saldo));
  const [fecha, setFecha] = useState(hoy());
  const [medio, setMedio] = useState(MEDIOS[0]);
  const [ref, setRef] = useState("");
  const [saving, setSaving] = useState(false);

  async function guardar() {
    const m = r2(Number(monto.replace(",", ".")));
    if (!(m > 0)) return toast.error("Monto inválido");
    if (m > saldo) return toast.error(`El pago no puede superar el saldo de ${formatCRC(saldo)}`);
    setSaving(true);
    const { error } = await supabase.from("pagos_cuentas_por_pagar").insert({ cuenta_id: cuenta.id, fecha, monto: m, medio_pago: medio, referencia: ref.trim() || null });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(m >= saldo ? "Cuenta cancelada; pasó al histórico" : "Abono registrado");
    onSaved(); onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Pago a {cuenta.proveedor}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{cuenta.producto} · Saldo pendiente <span className="font-semibold text-foreground">{formatCRC(saldo)}</span></p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>Monto a pagar (₡)</Label><Input inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} />
            <button type="button" className="text-xs text-primary underline" onClick={() => setMonto(String(saldo))}>Cancelar saldo completo</button></div>
          <div className="space-y-1"><Label>Fecha</Label><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
          <div className="space-y-1"><Label>Forma de pago</Label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={medio} onChange={(e) => setMedio(e.target.value)}>
              {MEDIOS.map((m) => <option key={m}>{m}</option>)}
            </select></div>
          <div className="space-y-1"><Label>Referencia (opcional)</Label><Input value={ref} onChange={(e) => setRef(e.target.value)} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cerrar</Button><Button disabled={saving} onClick={guardar}>Registrar pago</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
