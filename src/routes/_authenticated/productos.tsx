import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProductos, useInvalidate } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CatalogSelect } from "@/components/CatalogSelect";
import { toast } from "sonner";
import { Plus, Search, AlertTriangle, Trash2 } from "lucide-react";
import { useListasPrecios, usePreciosProductos } from "@/lib/listas-precios";

export const Route = createFileRoute("/_authenticated/productos")({
  head: () => ({
    meta: [
      { title: "Productos — Ruta Directo" },
      { name: "description", content: "Catálogo y existencias de Ruta Directo." },
      { property: "og:title", content: "Productos — Ruta Directo" },
      { property: "og:description", content: "Catálogo y existencias de Ruta Directo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductosPage,
});

const empty = { codigo: "", nombre: "", categoria_id: "", precio: 0, costo: 0, existencia: 0, existencia_minima: 5, activo: true, cabys: "", tarifa_iva: 13 };

export function ProductosPage() {
  const { data: productos } = useProductos();
  const { data: listas = [] } = useListasPrecios();
  const { data: precios = [] } = usePreciosProductos();
  const preciosPorProducto = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of precios) m.set(x.producto_id, (m.get(x.producto_id) ?? 0) + 1);
    return m;
  }, [precios]);
  const { isAdmin } = useAuth();
  const invalidate = useInvalidate();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);

  const [soloBajos, setSoloBajos] = useState(false);

  const filtered = useMemo(
    () =>
      (productos ?? []).filter((p) => {
        const matchSearch =
          p.nombre.toLowerCase().includes(search.toLowerCase()) ||
          p.codigo.toLowerCase().includes(search.toLowerCase());
        const matchBajo = !soloBajos || Number(p.existencia) <= Number(p.existencia_minima);
        return matchSearch && matchBajo;
      }),
    [productos, search, soloBajos],
  );

  const bajosCount = useMemo(
    () => (productos ?? []).filter((p) => Number(p.existencia) <= Number(p.existencia_minima)).length,
    [productos],
  );

  const grupos = useMemo(() => {
    const map = new Map<string, { nombre: string; items: typeof filtered }>();
    for (const p of filtered) {
      const nombre = (p as any).categorias?.nombre ?? "Sin categoría";
      const key = p.categoria_id ?? "__none__";
      if (!map.has(key)) map.set(key, { nombre, items: [] });
      map.get(key)!.items.push(p);
    }
    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [filtered]);

  function openNew() { setForm(empty); setEditId(null); setOpen(true); }
  function openEdit(p: any) {
    setForm({ codigo: p.codigo, nombre: p.nombre, categoria_id: p.categoria_id ?? "", precio: Number(p.precio), costo: Number(p.costo), existencia: Number(p.existencia), existencia_minima: Number(p.existencia_minima), activo: p.activo, cabys: p.cabys ?? "", tarifa_iva: Number(p.tarifa_iva ?? 13) });
    setEditId(p.id); setOpen(true);
  }

  async function remove() {
    if (!editId) return;
    if (!confirm("¿Eliminar este producto? Esta acción no se puede deshacer.")) return;
    setBusy(true);
    const { error } = await supabase.from("productos").delete().eq("id", editId);
    setBusy(false);
    if (error) {
      if (error.message.includes("foreign key") || error.code === "23503") {
        return toast.error("No se puede eliminar: el producto tiene ventas, pedidos o precios registrados. Mejor desactívalo.");
      }
      return toast.error(error.message);
    }
    toast.success("Producto eliminado");
    invalidate(["productos"]);
    setOpen(false);
  }

  async function save() {
    if (!form.codigo.trim() || !form.nombre.trim()) return toast.error("Código y nombre son obligatorios");
    setBusy(true);
    const payload = { ...form, categoria_id: form.categoria_id || null, cabys: form.cabys || null };
    const { error } = editId
      ? await supabase.from("productos").update(payload).eq("id", editId)
      : await supabase.from("productos").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editId ? "Producto actualizado" : "Producto creado");
    invalidate(["productos"]);
    setOpen(false);
  }

  return (
    <div>
      <PageHeader title="Productos" subtitle={`${productos?.length ?? 0} productos`} action={<Button onClick={openNew} className="gap-1.5"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Nuevo</span></Button>} />
      <div className="space-y-4 p-4 md:p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar producto…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button variant={soloBajos ? "outline" : "default"} size="sm" onClick={() => setSoloBajos(false)}>
            Todos
          </Button>
          <Button variant={soloBajos ? "default" : "outline"} size="sm" className="gap-1.5" onClick={() => setSoloBajos(true)}>
            <AlertTriangle className="h-4 w-4" />
            Stock bajo ({bajosCount})
          </Button>
        </div>
        <div className="space-y-6">
          {grupos.map((g) => (
            <div key={g.nombre}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{g.nombre}</h2>
                <Badge variant="secondary">{g.items.length}</Badge>
              </div>
              <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
                {g.items.map((p) => (
                  <Card key={p.id} className="cursor-pointer p-3" onClick={() => openEdit(p)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{p.nombre}</p>
                        <p className="text-xs text-muted-foreground">{p.codigo}</p>
                      </div>
                      {!p.activo && <Badge variant="secondary">Inactivo</Badge>}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{(preciosPorProducto.get(p.id) ?? 0)} de {listas.length} listas con precio</span>
                      <span className={`flex items-center gap-1 text-sm ${Number(p.existencia) <= Number(p.existencia_minima) ? "text-destructive" : "text-muted-foreground"}`}>
                        {Number(p.existencia) <= Number(p.existencia_minima) && <AlertTriangle className="h-3.5 w-3.5" />}
                        {Number(p.existencia)} u.
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Editar producto" : "Nuevo producto"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <F label="Código"><Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} /></F>
              <CatalogSelect
                catalogo="categorias"
                label="Categoría"
                placeholder="Categoría"
                value={form.categoria_id}
                onChange={(v) => setForm({ ...form, categoria_id: v })}
              />

            </div>
            <F label="Nombre"><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></F>
            <F label="Costo"><Input type="number" value={form.costo || ""} onChange={(e) => setForm({ ...form, costo: Number(e.target.value) || 0 })} /></F>
            <p className="rounded-lg border border-dashed p-2 text-xs text-muted-foreground">El precio de venta se define en Administración → Precios según la clasificación de cada cliente.</p>
            <div className="grid grid-cols-2 gap-3">
              <F label="Existencia"><Input type="number" value={form.existencia || ""} onChange={(e) => setForm({ ...form, existencia: Number(e.target.value) || 0 })} /></F>
              <F label="Mínimo"><Input type="number" value={form.existencia_minima || ""} onChange={(e) => setForm({ ...form, existencia_minima: Number(e.target.value) || 0 })} /></F>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Código CABYS"><Input inputMode="numeric" maxLength={13} value={form.cabys} onChange={(e) => setForm({ ...form, cabys: e.target.value.replace(/\D/g, "") })} /></F>
              <F label="IVA %"><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.tarifa_iva} onChange={(e) => setForm({ ...form, tarifa_iva: Number(e.target.value) })}>{[0,1,2,4,13].map((t) => <option key={t} value={t}>{t}%</option>)}</select></F>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>Producto activo</Label>
              <Switch checked={form.activo} onCheckedChange={(v) => setForm({ ...form, activo: v })} />
            </div>
            <Button className="w-full" size="lg" disabled={busy} onClick={save}>{busy ? "Guardando…" : "Guardar"}</Button>
            {isAdmin && editId && (
              <Button variant="destructive" className="w-full gap-1.5" disabled={busy} onClick={remove}>
                <Trash2 className="h-4 w-4" /> Eliminar producto
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
