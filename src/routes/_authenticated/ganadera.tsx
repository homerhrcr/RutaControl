import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCRC } from "@/lib/format";
import { semanaDe, moverSemana, balanceFinca } from "@/lib/finca";
import { toast } from "sonner";
import { OpcionSelect } from "@/components/OpcionSelect";
import { ChevronLeft, ChevronRight, Trash2, Plus, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ganadera")({
  head: () => ({
    meta: [
      { title: "Operaciones / Planta — Ruta Directo" },
      { name: "description", content: "Gastos de operación, precios de productos y balance semanal de la planta." },
      { property: "og:title", content: "Operaciones / Planta — Ruta Directo" },
      { property: "og:description", content: "Gastos de operación, precios de productos y balance semanal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GanaderaPage,
});


function hoy() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

type Prod = { id: string; nombre: string; unidad: string; precio: number; activo: boolean; orden: number };

function GanaderaPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [semana, setSemana] = useState(semanaDe(hoy()));
  const refresh = () => qc.invalidateQueries({ queryKey: ["finca"] });

  const productos = useQuery({
    queryKey: ["finca", "productos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("finca_productos").select("*").order("orden").order("nombre");
      if (error) throw error;
      return data as Prod[];
    },
    enabled: isAdmin,
  });
  const gastos = useQuery({
    queryKey: ["finca", "gastos", semana.desde],
    queryFn: async () => {
      const { data, error } = await supabase.from("finca_gastos").select("*").gte("fecha", semana.desde).lte("fecha", semana.hasta).order("fecha", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });
  const produccion = useQuery({
    queryKey: ["finca", "produccion", semana.desde],
    queryFn: async () => {
      const { data, error } = await supabase.from("finca_produccion").select("*").gte("fecha", semana.desde).lte("fecha", semana.hasta).order("fecha", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const balance = useMemo(() => balanceFinca(gastos.data ?? [], produccion.data ?? []), [gastos.data, produccion.data]);
  const nombreProd = new Map((productos.data ?? []).map((p) => [p.id, p]));

  if (!isAdmin) return <div className="p-6 text-muted-foreground">Solo los administradores pueden ver Operaciones / Planta.</div>;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader title="Operaciones / Planta" subtitle="Gastos de operación, precios de sus productos y balance por semana." />

      <Card className="flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => setSemana(moverSemana(semana.desde, -1))} aria-label="Semana anterior"><ChevronLeft className="h-4 w-4" /></Button>
          <Input type="date" className="w-40" value={semana.desde} onChange={(e) => e.target.value && setSemana(semanaDe(e.target.value))} />
          <Button size="icon" variant="outline" onClick={() => setSemana(moverSemana(semana.desde, 1))} aria-label="Semana siguiente"><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <span className="text-sm text-muted-foreground">Semana del {semana.desde} al {semana.hasta}</span>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Producido (a precio de venta)</p><p className="text-xl font-bold">{formatCRC(balance.totalProducido)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Gastos de operación</p><p className="text-xl font-bold text-destructive">{formatCRC(balance.totalGastos)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Resultado de la semana</p><p className={`text-xl font-bold ${balance.utilidad >= 0 ? "text-primary" : "text-destructive"}`}>{formatCRC(balance.utilidad)}</p></Card>
      </div>

      <Tabs defaultValue="gastos">
        <TabsList className="flex-wrap">
          <TabsTrigger value="gastos">Gastos</TabsTrigger>
          <TabsTrigger value="produccion">Producción</TabsTrigger>
          <TabsTrigger value="precios">Productos y precios</TabsTrigger>
        </TabsList>

        <TabsContent value="gastos" className="space-y-3">
          <NuevoGasto onSaved={refresh} />
          <Card className="divide-y">
            {(gastos.data ?? []).map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                <div className="min-w-0"><p className="font-medium">{g.categoria}</p><p className="truncate text-xs text-muted-foreground">{g.fecha} {g.descripcion ? `· ${g.descripcion}` : ""}</p></div>
                <div className="flex items-center gap-2"><span className="font-semibold">{formatCRC(Number(g.monto))}</span>
                  <Button size="icon" variant="ghost" aria-label="Borrar gasto" onClick={async () => { if (!confirm("¿Borrar este gasto?")) return; const { error } = await supabase.from("finca_gastos").delete().eq("id", g.id); if (error) toast.error(error.message); else refresh(); }}><Trash2 className="h-4 w-4" /></Button></div>
              </div>
            ))}
            {(gastos.data ?? []).length === 0 && <p className="p-4 text-sm text-muted-foreground">No hay gastos en esta semana.</p>}
          </Card>
        </TabsContent>

        <TabsContent value="produccion" className="space-y-3">
          <NuevaProduccion productos={(productos.data ?? []).filter((p) => p.activo)} onSaved={refresh} />
          <Card className="divide-y">
            {(produccion.data ?? []).map((p) => {
              const pr = nombreProd.get(p.producto_id);
              return (
                <div key={p.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                  <div><p className="font-medium">{pr?.nombre ?? "Producto"}</p><p className="text-xs text-muted-foreground">{p.fecha} · {Number(p.cantidad)} {pr?.unidad} × {formatCRC(Number(p.precio_unitario))}</p></div>
                  <div className="flex items-center gap-2"><span className="font-semibold">{formatCRC(Number(p.cantidad) * Number(p.precio_unitario))}</span>
                    <Button size="icon" variant="ghost" aria-label="Borrar producción" onClick={async () => { if (!confirm("¿Borrar este registro?")) return; const { error } = await supabase.from("finca_produccion").delete().eq("id", p.id); if (error) toast.error(error.message); else refresh(); }}><Trash2 className="h-4 w-4" /></Button></div>
                </div>
              );
            })}
            {(produccion.data ?? []).length === 0 && <p className="p-4 text-sm text-muted-foreground">No hay producción registrada en esta semana.</p>}
          </Card>
        </TabsContent>

        <TabsContent value="precios" className="space-y-3">
          <Card className="divide-y">
            {(productos.data ?? []).map((p) => <FilaPrecio key={p.id} p={p} onSaved={refresh} />)}
          </Card>
          <NuevoProducto onSaved={refresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NuevoGasto({ onSaved }: { onSaved: () => void }) {
  const [fecha, setFecha] = useState(hoy());
  const [categoria, setCategoria] = useState("");
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [busy, setBusy] = useState(false);
  async function guardar() {
    const m = Number(monto);
    if (!(m > 0)) return toast.error("Escriba un monto mayor a cero");
    setBusy(true);
    const { error } = await supabase.from("finca_gastos").insert({ fecha, categoria, monto: m, descripcion: descripcion || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Gasto registrado");
    setMonto(""); setDescripcion(""); onSaved();
  }
  return (
    <Card className="grid gap-3 p-3 sm:grid-cols-5">
      <div><Label>Fecha</Label><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
      <div><Label>Categoría</Label>
        <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
        </select></div>
      <div><Label>Monto ₡</Label><Input inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} /></div>
      <div><Label>Detalle</Label><Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Opcional" /></div>
      <div className="flex items-end"><Button className="w-full" disabled={busy} onClick={guardar}><Plus className="mr-1 h-4 w-4" />Agregar gasto</Button></div>
    </Card>
  );
}

function NuevaProduccion({ productos, onSaved }: { productos: Prod[]; onSaved: () => void }) {
  const [fecha, setFecha] = useState(hoy());
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [busy, setBusy] = useState(false);
  const prod = productos.find((p) => p.id === productoId);
  async function guardar() {
    const c = Number(cantidad);
    if (!prod) return toast.error("Elija un producto");
    if (!(c > 0)) return toast.error("Escriba una cantidad mayor a cero");
    if (!(Number(prod.precio) > 0)) return toast.error("Ese producto no tiene precio. Asígnelo en Productos y precios.");
    setBusy(true);
    const { error } = await supabase.from("finca_produccion").insert({ fecha, producto_id: prod.id, cantidad: c, precio_unitario: Number(prod.precio) });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Producción registrada");
    setCantidad(""); onSaved();
  }
  return (
    <Card className="grid gap-3 p-3 sm:grid-cols-4">
      <div><Label>Fecha</Label><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
      <div><Label>Producto</Label>
        <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={productoId} onChange={(e) => setProductoId(e.target.value)}>
          <option value="">Elegir…</option>
          {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({formatCRC(Number(p.precio))}/{p.unidad})</option>)}
        </select></div>
      <div><Label>Cantidad {prod ? `(${prod.unidad})` : ""}</Label><Input inputMode="decimal" value={cantidad} onChange={(e) => setCantidad(e.target.value)} /></div>
      <div className="flex items-end"><Button className="w-full" disabled={busy} onClick={guardar}><Plus className="mr-1 h-4 w-4" />Registrar</Button></div>
    </Card>
  );
}

function FilaPrecio({ p, onSaved }: { p: Prod; onSaved: () => void }) {
  const [precio, setPrecio] = useState(String(p.precio));
  const [unidad, setUnidad] = useState(p.unidad);
  async function guardar() {
    const v = Number(precio);
    if (!(v >= 0)) return toast.error("Precio inválido");
    const { error } = await supabase.from("finca_productos").update({ precio: v, unidad }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(`Precio de ${p.nombre} guardado`); onSaved();
  }
  async function alternar() {
    const { error } = await supabase.from("finca_productos").update({ activo: !p.activo }).eq("id", p.id);
    if (error) toast.error(error.message); else onSaved();
  }
  return (
    <div className="flex flex-wrap items-center gap-2 p-3 text-sm">
      <span className={`min-w-32 flex-1 font-medium ${p.activo ? "" : "text-muted-foreground line-through"}`}>{p.nombre}</span>
      <Input className="w-24" value={unidad} onChange={(e) => setUnidad(e.target.value)} aria-label="Unidad" />
      <Input className="w-28" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} aria-label="Precio de venta" />
      <Button size="sm" onClick={guardar}><Save className="mr-1 h-4 w-4" />Guardar</Button>
      <Button size="sm" variant="outline" onClick={alternar}>{p.activo ? "Desactivar" : "Activar"}</Button>
    </div>
  );
}

function NuevoProducto({ onSaved }: { onSaved: () => void }) {
  const [nombre, setNombre] = useState("");
  async function crear() {
    if (!nombre.trim()) return;
    const { error } = await supabase.from("finca_productos").insert({ nombre: nombre.trim(), orden: 999 });
    if (error) return toast.error(error.message);
    setNombre(""); onSaved();
  }
  return (
    <Card className="flex gap-2 p-3">
      <Input placeholder="Nuevo producto de la finca" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <Button onClick={crear}><Plus className="mr-1 h-4 w-4" />Agregar</Button>
    </Card>
  );
}
