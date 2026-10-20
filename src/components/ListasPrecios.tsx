import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProductos, useRutas } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { useListasPrecios, usePreciosProductos } from "@/lib/listas-precios";
import { validarPrecio } from "@/lib/precios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Save, Search, Copy } from "lucide-react";
import { toast } from "sonner";

export function ListasPrecios() {
  const { data: listas = [], error } = useListasPrecios();
  const { data: precios, error: preciosError } = usePreciosProductos();
  const { data: productos = [] } = useProductos();
  const { data: rutas = [] } = useRutas();
  const qc = useQueryClient();
  const [seleccion, setSeleccion] = useState("");
  const [dialogo, setDialogo] = useState<"crear" | "editar" | "duplicar" | null>(null);
  const [form, setForm] = useState({ nombre: "", descripcion: "", activo: true, fecha_inicio: "", fecha_fin: "" });
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [masivo, setMasivo] = useState("");
  const lista = listas.find((l) => l.id === seleccion) ?? listas[0];
  const rutasDe = (id: string) => rutas.filter((r) => r.lista_precio_id === id).map((r) => r.nombre);
  const cantidadDe = (id: string) => (precios ?? []).filter((p) => p.lista_id === id).length;
  const filtrados = productos.filter((p) => `${p.nombre} ${p.codigo}`.toLowerCase().includes(search.toLowerCase()));

  function abrir(modo: "crear" | "editar" | "duplicar") {
    setForm(modo === "crear" || !lista ? { nombre: "", descripcion: "", activo: true, fecha_inicio: "", fecha_fin: "" }
      : { nombre: modo === "duplicar" ? `${lista.nombre} (copia)` : lista.nombre, descripcion: lista.descripcion ?? "", activo: lista.activo, fecha_inicio: lista.fecha_inicio ?? "", fecha_fin: lista.fecha_fin ?? "" });
    setDialogo(modo);
  }

  async function guardarLista() {
    if (!form.nombre.trim()) return toast.error("El nombre es obligatorio");
    if (form.fecha_inicio && form.fecha_fin && form.fecha_fin < form.fecha_inicio) return toast.error("La fecha final debe ser posterior a la inicial");
    setBusy(true);
    try {
      const datos = { nombre: form.nombre.trim(), descripcion: form.descripcion.trim() || null, activo: form.activo, fecha_inicio: form.fecha_inicio || null, fecha_fin: form.fecha_fin || null };
      const q = dialogo === "editar" && lista
        ? supabase.from("listas_precios").update(datos).eq("id", lista.id)
        : supabase.from("listas_precios").insert(datos);
      const { data, error } = await q.select("id").single();
      if (error) throw error;
      if (dialogo === "duplicar" && lista) {
        const copia = (precios ?? []).filter((p) => p.lista_id === lista.id).map((p) => ({ lista_id: data.id, producto_id: p.producto_id, precio: p.precio }));
        if (copia.length) { const { error: e2 } = await supabase.from("precios_productos").insert(copia); if (e2) throw e2; }
      }
      setSeleccion(data.id);
      await qc.invalidateQueries({ queryKey: ["listas_precios"] });
      await qc.invalidateQueries({ queryKey: ["precios_productos"] });
      setDialogo(null);
      toast.success(dialogo === "duplicar" ? "Lista duplicada" : "Lista de precios guardada");
    } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo guardar la lista"); }
    finally { setBusy(false); }
  }

  /** Ajuste masivo por porcentaje sobre los productos filtrados que ya tienen precio en la lista. */
  async function ajusteMasivo() {
    if (!lista) return;
    const pct = Number(masivo);
    if (!Number.isFinite(pct) || pct === 0 || pct <= -100) return toast.error("Indique un porcentaje válido, por ejemplo 5 o -3");
    const ids = new Set(filtrados.map((p) => p.id));
    const filas = (precios ?? []).filter((p) => p.lista_id === lista.id && ids.has(p.producto_id))
      .map((p) => ({ lista_id: lista.id, producto_id: p.producto_id, precio: Math.round(Number(p.precio) * (1 + pct / 100) * 100) / 100 }));
    if (!filas.length) return toast.error("No hay precios configurados en los productos mostrados");
    if (!confirm(`¿Ajustar ${filas.length} precio(s) de "${lista.nombre}" en ${pct}%?`)) return;
    setBusy(true);
    const { error: e } = await supabase.from("precios_productos").upsert(filas, { onConflict: "lista_id,producto_id" });
    setBusy(false);
    if (e) return toast.error(e.message);
    await qc.invalidateQueries({ queryKey: ["precios_productos"] });
    setMasivo("");
    toast.success(`${filas.length} precio(s) actualizados`);
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-bold">Listas de precios</h2>
      <Button size="sm" onClick={() => abrir("crear")}><Plus className="mr-1 h-4 w-4" />Nueva lista</Button>
    </div>
    {(error || preciosError) && <p className="text-sm text-destructive">No se pudieron cargar los precios.</p>}
    {listas.length > 0 && <div className="grid gap-2 md:grid-cols-2">
      {listas.map((l) => <button key={l.id} type="button" onClick={() => setSeleccion(l.id)} className={`rounded-lg border p-3 text-left text-sm ${lista?.id === l.id ? "border-primary ring-1 ring-primary" : ""}`}>
        <div className="flex items-center justify-between gap-2"><span className="font-semibold">{l.nombre}</span><Badge variant={l.activo ? "secondary" : "outline"}>{l.activo ? "Activa" : "Inactiva"}</Badge></div>
        {l.descripcion && <p className="text-xs text-muted-foreground">{l.descripcion}</p>}
        <p className="text-xs text-muted-foreground">{cantidadDe(l.id)} producto(s) · Vigencia: {l.fecha_inicio ?? "siempre"} → {l.fecha_fin ?? "sin fin"}</p>
        <p className="text-xs text-muted-foreground">Rutas: {rutasDe(l.id).join(", ") || "ninguna"} · Modificada {new Date(l.updated_at).toLocaleDateString("es-CR")}</p>
      </button>)}
    </div>}
    {listas.length > 0 && lista ? <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => abrir("editar")}><Pencil className="mr-1 h-4 w-4" />Editar lista</Button>
        <Button variant="outline" size="sm" onClick={() => abrir("duplicar")}><Copy className="mr-1 h-4 w-4" />Duplicar</Button>
      </div>
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar producto por código o nombre…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="flex flex-wrap items-end gap-2"><div className="space-y-1"><Label htmlFor="ajuste-masivo" className="text-xs">Ajuste masivo (%) a los productos mostrados</Label><Input id="ajuste-masivo" type="number" className="w-32" placeholder="Ej. 5" value={masivo} onChange={(e) => setMasivo(e.target.value)} /></div><Button size="sm" variant="secondary" disabled={busy || !masivo} onClick={ajusteMasivo}>Aplicar</Button></div>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-3">Código</th><th className="py-2 pr-3">Producto</th><th className="px-2 py-2">Precio de lista</th><th className="w-10" /></tr></thead>
        <tbody>{precios !== undefined && filtrados.map((p) => {
          const fijo = precios.find((x) => x.lista_id === lista.id && x.producto_id === p.id);
          return <PrecioFila key={`${lista.id}-${p.id}-${fijo?.updated_at ?? "base"}`} listaId={lista.id} producto={p} precio={fijo?.precio} />;
        })}</tbody>
      </table></div>
    </> : !error && <p className="text-sm text-muted-foreground">Sin listas de precios.</p>}
    <Dialog open={dialogo !== null} onOpenChange={(v) => !v && setDialogo(null)}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>{dialogo === "crear" ? "Nueva lista de precios" : dialogo === "duplicar" ? "Duplicar lista" : "Editar lista"}</DialogTitle></DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="nombre-lista">Nombre</Label><Input id="nombre-lista" placeholder="Ej. Ruta jueves" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        <Label htmlFor="desc-lista">Descripción</Label><Input id="desc-lista" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
        <div className="grid grid-cols-2 gap-2"><div><Label htmlFor="ini-lista" className="text-xs">Vigente desde</Label><Input id="ini-lista" type="date" value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} /></div><div><Label htmlFor="fin-lista" className="text-xs">Hasta (opcional)</Label><Input id="fin-lista" type="date" value={form.fecha_fin} onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })} /></div></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />Lista activa</label>
      </div>
      <Button onClick={guardarLista} disabled={busy}>{busy ? "Guardando…" : "Guardar lista"}</Button>
    </DialogContent></Dialog>
  </div>;
}

function PrecioFila({ listaId, producto, precio }: { listaId: string; producto: { id: string; codigo: string; nombre: string; precio: number }; precio?: number }) {
  const [valor, setValor] = useState(precio === undefined ? "" : String(precio));
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  async function guardar() {
    setBusy(true);
    try {
      const n = validarPrecio(valor);
      const { error } = n === null
        ? await supabase.from("precios_productos").delete().eq("lista_id", listaId).eq("producto_id", producto.id)
        : await supabase.from("precios_productos").upsert({ lista_id: listaId, producto_id: producto.id, precio: n }, { onConflict: "lista_id,producto_id" });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["precios_productos"] });
      toast.success("Precio guardado");
    } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo guardar el precio"); }
    finally { setBusy(false); }
  }
  return <tr className="border-b border-border/50">
    <td className="py-2 pr-3 text-xs text-muted-foreground">{producto.codigo}</td><td className="min-w-32 py-2 pr-3 font-medium">{producto.nombre}</td>
    <td className="px-2 py-2"><Input type="number" min="0" step="0.01" className="w-32" aria-label={`Precio de ${producto.nombre}`} placeholder="Sin precio" value={valor} onChange={(e) => setValor(e.target.value)} /></td>
    <td><Button size="icon" variant="ghost" aria-label={`Guardar precio de ${producto.nombre}`} title="Guardar precio" disabled={busy || valor === (precio === undefined ? "" : String(precio))} onClick={guardar}><Save className="h-4 w-4" /></Button></td>
  </tr>;
}
