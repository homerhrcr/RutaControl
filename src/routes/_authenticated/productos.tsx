import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProductos, useCategorias, useInvalidate } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search, AlertTriangle } from "lucide-react";
import { formatCRC } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/productos")({
  component: ProductosPage,
});

const empty = { codigo: "", nombre: "", categoria_id: "", precio: 0, costo: 0, existencia: 0, existencia_minima: 5, activo: true };

function ProductosPage() {
  const { data: productos } = useProductos();
  const { data: categorias } = useCategorias();
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

  function openNew() { setForm(empty); setEditId(null); setOpen(true); }
  function openEdit(p: any) {
    setForm({ codigo: p.codigo, nombre: p.nombre, categoria_id: p.categoria_id ?? "", precio: Number(p.precio), costo: Number(p.costo), existencia: Number(p.existencia), existencia_minima: Number(p.existencia_minima), activo: p.activo });
    setEditId(p.id); setOpen(true);
  }

  async function save() {
    if (!form.codigo.trim() || !form.nombre.trim()) return toast.error("Código y nombre son obligatorios");
    setBusy(true);
    const payload = { ...form, categoria_id: form.categoria_id || null };
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
        <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Card key={p.id} className="cursor-pointer p-3" onClick={() => openEdit(p)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{p.nombre}</p>
                  <p className="text-xs text-muted-foreground">{p.codigo} · {(p as any).categorias?.nombre ?? "—"}</p>
                </div>
                {!p.activo && <Badge variant="secondary">Inactivo</Badge>}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-lg font-black text-primary">{formatCRC(p.precio)}</span>
                <span className={`flex items-center gap-1 text-sm ${Number(p.existencia) <= Number(p.existencia_minima) ? "text-destructive" : "text-muted-foreground"}`}>
                  {Number(p.existencia) <= Number(p.existencia_minima) && <AlertTriangle className="h-3.5 w-3.5" />}
                  {Number(p.existencia)} u.
                </span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Editar producto" : "Nuevo producto"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <F label="Código"><Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} /></F>
              <F label="Categoría">
                <Select value={form.categoria_id} onValueChange={(v) => setForm({ ...form, categoria_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Categoría" /></SelectTrigger>
                  <SelectContent>{categorias?.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
                </Select>
              </F>
            </div>
            <F label="Nombre"><Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Precio"><Input type="number" value={form.precio || ""} onChange={(e) => setForm({ ...form, precio: Number(e.target.value) || 0 })} /></F>
              <F label="Costo"><Input type="number" value={form.costo || ""} onChange={(e) => setForm({ ...form, costo: Number(e.target.value) || 0 })} /></F>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Existencia"><Input type="number" value={form.existencia || ""} onChange={(e) => setForm({ ...form, existencia: Number(e.target.value) || 0 })} /></F>
              <F label="Mínimo"><Input type="number" value={form.existencia_minima || ""} onChange={(e) => setForm({ ...form, existencia_minima: Number(e.target.value) || 0 })} /></F>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>Producto activo</Label>
              <Switch checked={form.activo} onCheckedChange={(v) => setForm({ ...form, activo: v })} />
            </div>
            <Button className="w-full" size="lg" disabled={busy} onClick={save}>{busy ? "Guardando…" : "Guardar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
