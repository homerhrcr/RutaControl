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
import { Plus, Receipt, Search, Check, ChevronsUpDown, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { Link } from "@tanstack/react-router";
import { useProductos } from "@/lib/data";
import { useOpciones } from "@/lib/catalogos";
import { CatalogoDialog } from "@/components/CatalogSelect";
import { useAuth } from "@/lib/auth";

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
  monto: number; pagado: number; estado: string; notas: string | null; numero_factura: string | null; cancelada_en: string | null;
  pagos_cuentas_por_pagar: Pago[];
};

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
    (c) => !q || c.proveedor.toLowerCase().includes(q) || c.producto.toLowerCase().includes(q) || (c.numero_factura ?? "").toLowerCase().includes(q),
  );

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
          <Input className="pl-8" placeholder="Buscar proveedor, producto o factura" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
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
                  <td className="p-2 font-medium">{c.proveedor}{c.numero_factura && <div className="text-xs font-normal text-muted-foreground">Fact. {c.numero_factura}</div>}</td>
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

      {nueva && <NuevaCuenta onClose={() => setNueva(false)} onSaved={refrescar} />}
      {pagando && <PagoDialog cuenta={pagando} onClose={() => setPagando(null)} onSaved={refrescar} />}
      <Dialog open={!!detalle} onOpenChange={(o) => !o && setDetalle(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pagos · {detalle?.proveedor}</DialogTitle></DialogHeader>
          {detalle && (
            <div className="space-y-2 text-sm">
              <p>{detalle.producto} — {Number(detalle.cantidad).toLocaleString("es-CR")} {detalle.unidad} · {formatCRC(Number(detalle.monto))}</p>
              {detalle.numero_factura && <p>Factura: {detalle.numero_factura}</p>}
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

type Prov = { id: string; nombre: string; identificacion: string | null; telefono: string | null; correo: string | null; activo: boolean };

function useProveedores() {
  return useQuery({
    queryKey: ["proveedores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("proveedores").select("id, nombre, identificacion, telefono, correo, activo").order("nombre");
      if (error) throw error;
      return (data ?? []) as Prov[];
    },
  });
}

/** Lista desplegable con buscador y opción para crear desde lo escrito. */
function Combo({ value, onChange, opciones, placeholder, onCrear, crearTexto }: {
  value: string; onChange: (v: string) => void; opciones: { value: string; label: string; hint?: string }[];
  placeholder: string; onCrear?: (texto: string) => void; crearTexto?: string;
}) {
  const [open, setOpen] = useState(false);
  const [txt, setTxt] = useState("");
  const existe = opciones.some((o) => o.label.toLowerCase() === txt.trim().toLowerCase());
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className={value ? "truncate" : "truncate text-muted-foreground"}>{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar…" value={txt} onValueChange={setTxt} />
          <CommandList>
            <CommandEmpty>Sin resultados</CommandEmpty>
            {onCrear && txt.trim() && !existe && (
              <CommandGroup>
                <CommandItem value={`__crear__${txt}`} onSelect={() => { onCrear(txt.trim()); setTxt(""); setOpen(false); }}>
                  <Plus className="mr-2 h-4 w-4" />{crearTexto} «{txt.trim()}»
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {opciones.map((o) => (
                <CommandItem key={o.value} value={o.label} onSelect={() => { onChange(o.label); setTxt(""); setOpen(false); }}>
                  <Check className={`mr-2 h-4 w-4 ${value === o.label ? "opacity-100" : "opacity-0"}`} />
                  <span className="truncate">{o.label}</span>
                  {o.hint && <span className="ml-auto pl-2 text-xs text-muted-foreground">{o.hint}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ProveedoresDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const { data: provs = [] } = useProveedores();
  const [nuevo, setNuevo] = useState({ nombre: "", identificacion: "", telefono: "", correo: "" });
  const refrescar = () => qc.invalidateQueries({ queryKey: ["proveedores"] });
  async function actualizar(id: string, cambios: Partial<Prov>) {
    const { error } = await supabase.from("proveedores").update(cambios).eq("id", id);
    if (error) return toast.error(error.message.includes("proveedores_nombre_uq") ? "Ya existe un proveedor con ese nombre" : error.message);
    refrescar();
  }
  async function agregar() {
    if (!nuevo.nombre.trim()) return toast.error("Indique el nombre");
    const { error } = await supabase.from("proveedores").insert({
      nombre: nuevo.nombre.trim(), identificacion: nuevo.identificacion.trim() || null,
      telefono: nuevo.telefono.trim() || null, correo: nuevo.correo.trim() || null,
    });
    if (error) return toast.error(error.message.includes("proveedores_nombre_uq") ? "Ya existe un proveedor con ese nombre" : error.message);
    setNuevo({ nombre: "", identificacion: "", telefono: "", correo: "" }); refrescar();
  }
  async function eliminar(p: Prov) {
    const { count } = await supabase.from("cuentas_por_pagar").select("id", { count: "exact", head: true }).eq("proveedor", p.nombre);
    if (count) {
      if (confirm(`"${p.nombre}" tiene ${count} cuenta(s) registradas y no se puede eliminar. ¿Desactivarlo para que no se ofrezca en compras nuevas?`)) actualizar(p.id, { activo: false });
      return;
    }
    if (!confirm(`¿Eliminar el proveedor "${p.nombre}"?`)) return;
    const { error } = await supabase.from("proveedores").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    refrescar();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Proveedores</DialogTitle></DialogHeader>
        <div className="grid gap-2 sm:grid-cols-5">
          <Input className="sm:col-span-2" placeholder="Nombre *" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
          <Input placeholder="Cédula" value={nuevo.identificacion} onChange={(e) => setNuevo({ ...nuevo, identificacion: e.target.value })} />
          <Input placeholder="Teléfono" value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} />
          <Button onClick={agregar}><Plus className="mr-1 h-4 w-4" />Agregar</Button>
        </div>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {provs.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Aún no hay proveedores.</p>}
          {provs.map((p) => (
            <div key={p.id} className="grid items-center gap-2 rounded-md border p-2 sm:grid-cols-[2fr_1fr_1fr_auto_auto]">
              <Input defaultValue={p.nombre} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== p.nombre && actualizar(p.id, { nombre: e.target.value.trim() })} />
              <Input placeholder="Cédula" defaultValue={p.identificacion ?? ""} onBlur={(e) => e.target.value !== (p.identificacion ?? "") && actualizar(p.id, { identificacion: e.target.value.trim() || null })} />
              <Input placeholder="Teléfono" defaultValue={p.telefono ?? ""} onBlur={(e) => e.target.value !== (p.telefono ?? "") && actualizar(p.id, { telefono: e.target.value.trim() || null })} />
              <label className="flex items-center gap-1 text-xs"><Switch checked={p.activo} onCheckedChange={(v) => actualizar(p.id, { activo: v })} />Activo</label>
              {isAdmin ? <Button size="icon" variant="ghost" aria-label="Eliminar" onClick={() => eliminar(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button> : <span />}
            </div>
          ))}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cerrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NuevaCuenta({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const { data: provs = [] } = useProveedores();
  const { data: productos = [] } = useProductos(true);
  const { data: unidades = [] } = useOpciones("unidad_medida");
  const unidadPred = unidades.find((u) => u.predeterminado && u.activo)?.etiqueta ?? unidades.find((u) => u.activo)?.etiqueta ?? "unidad";
  const [f, setF] = useState({ fecha: hoy(), proveedor: "", producto: "", cantidad: "1", unidad: "", monto: "", numero_factura: "", notas: "" });
  const [saving, setSaving] = useState(false);
  const [adminProv, setAdminProv] = useState(false);
  const [adminUni, setAdminUni] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const unidad = f.unidad || unidadPred;

  async function crearProveedor(nombre: string) {
    const { error } = await supabase.from("proveedores").insert({ nombre });
    if (error) return toast.error(error.message.includes("proveedores_nombre_uq") ? "Ya existe un proveedor con ese nombre" : error.message);
    await qc.invalidateQueries({ queryKey: ["proveedores"] });
    setF((x) => ({ ...x, proveedor: nombre }));
    toast.success("Proveedor agregado");
  }
  async function crearProducto(nombre: string) {
    const { error } = await supabase.from("productos").insert({ nombre, codigo: `CXP-${Date.now().toString(36).toUpperCase()}`, precio: 0, costo: 0 });
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["productos"] });
    setF((x) => ({ ...x, producto: nombre }));
    toast.success("Producto agregado al catálogo. Complete su precio en Productos.");
  }

  async function guardar() {
    const cantidad = Number(f.cantidad.replace(",", "."));
    const monto = Number(f.monto.replace(",", "."));
    if (!f.proveedor.trim() || !f.producto.trim()) return toast.error("Seleccione proveedor y producto");
    if (!(cantidad > 0) || !(monto > 0)) return toast.error("Cantidad y monto deben ser mayores a cero");
    setSaving(true);
    const { error } = await supabase.from("cuentas_por_pagar").insert({
      fecha: f.fecha, proveedor: f.proveedor.trim(), producto: f.producto.trim(), cantidad, unidad, monto: r2(monto),
      numero_factura: f.numero_factura.trim() || null, notas: f.notas.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Cuenta por pagar registrada");
    onSaved(); onClose();
  }

  const enlace = "text-xs font-medium text-primary hover:underline";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Registrar cuenta por pagar</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>Fecha de compra</Label><Input type="date" value={f.fecha} onChange={set("fecha")} /></div>
          <div className="space-y-1">
            <div className="flex items-center justify-between"><Label>Proveedor</Label><button type="button" className={enlace} onClick={() => setAdminProv(true)}>Administrar</button></div>
            <Combo value={f.proveedor} onChange={(v) => setF({ ...f, proveedor: v })} placeholder="Seleccione proveedor"
              opciones={provs.filter((p) => p.activo || p.nombre === f.proveedor).map((p) => ({ value: p.id, label: p.nombre, hint: p.identificacion ?? undefined }))}
              onCrear={crearProveedor} crearTexto="Agregar proveedor" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <div className="flex items-center justify-between"><Label>Producto</Label><Link to="/productos" className={enlace}>Administrar productos</Link></div>
            <Combo value={f.producto} onChange={(v) => setF({ ...f, producto: v })} placeholder="Seleccione producto del catálogo"
              opciones={productos.map((p: any) => ({ value: p.id, label: p.nombre, hint: p.categorias?.nombre ?? undefined }))}
              onCrear={crearProducto} crearTexto="Agregar al catálogo" />
          </div>
          <div className="space-y-1"><Label>Cantidad</Label><Input inputMode="decimal" value={f.cantidad} onChange={set("cantidad")} /></div>
          <div className="space-y-1">
            <div className="flex items-center justify-between"><Label>Unidad de medida</Label>{isAdmin && <button type="button" className={enlace} onClick={() => setAdminUni(true)}>Administrar</button>}</div>
            <Combo value={unidad} onChange={(v) => setF({ ...f, unidad: v })} placeholder="Unidad"
              opciones={unidades.filter((u) => u.activo || u.etiqueta === unidad).map((u) => ({ value: u.id, label: u.etiqueta }))} />
          </div>
          <div className="space-y-1"><Label>Monto total (₡)</Label><Input inputMode="decimal" value={f.monto} onChange={set("monto")} /></div>
          <div className="space-y-1"><Label>N.º de factura (opcional)</Label><Input value={f.numero_factura} onChange={set("numero_factura")} /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Notas u observaciones (opcional)</Label><Textarea rows={2} value={f.notas} onChange={set("notas")} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={saving} onClick={guardar}>Guardar</Button></DialogFooter>
        {adminProv && <ProveedoresDialog onClose={() => setAdminProv(false)} />}
        <CatalogoDialog catalogo="unidad_medida" abierto={adminUni} cerrar={() => setAdminUni(false)} onRenamed={(a, n) => unidad === a && setF((x) => ({ ...x, unidad: n }))} />
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
