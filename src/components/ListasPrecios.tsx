import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProductos } from "@/lib/data";
import { useListasPrecios, usePreciosProductos } from "@/lib/listas-precios";
import { validarPrecio } from "@/lib/precios";
import { formatCRC } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Save, Search } from "lucide-react";
import { toast } from "sonner";

export function ListasPrecios() {
  const { data: listas = [], error } = useListasPrecios();
  const { data: precios, error: preciosError } = usePreciosProductos();
  const { data: productos = [] } = useProductos();
  const qc = useQueryClient();
  const [seleccion, setSeleccion] = useState("");
  const [dialogo, setDialogo] = useState<"crear" | "editar" | null>(null);
  const [nombre, setNombre] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const lista = listas.find((l) => l.id === seleccion) ?? listas[0];

  async function guardarLista() {
    if (!nombre.trim()) return toast.error("El nombre es obligatorio");
    setBusy(true);
    try {
      const q = dialogo === "editar" && lista
        ? supabase.from("listas_precios").update({ nombre: nombre.trim() }).eq("id", lista.id)
        : supabase.from("listas_precios").insert({ nombre: nombre.trim() });
      const { data, error } = await q.select("id").single();
      if (error) throw error;
      setSeleccion(data.id);
      await qc.invalidateQueries({ queryKey: ["listas_precios"] });
      setDialogo(null);
      toast.success("Lista de precios guardada");
    } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo guardar la lista"); }
    finally { setBusy(false); }
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-bold">Listas de precios</h2>
      <Button size="sm" onClick={() => { setNombre(""); setDialogo("crear"); }}><Plus className="mr-1 h-4 w-4" />Nueva lista</Button>
    </div>
    {(error || preciosError) && <p className="text-sm text-destructive">No se pudieron cargar los precios.</p>}
    {listas.length > 0 ? <>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1"><Label htmlFor="lista-precios-admin">Clasificación / lista</Label>
          <select id="lista-precios-admin" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={lista?.id ?? ""} onChange={(e) => setSeleccion(e.target.value)}>{listas.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}</select>
        </div>
        <Button variant="outline" size="icon" aria-label="Renombrar lista" title="Renombrar lista" onClick={() => { setNombre(lista?.nombre ?? ""); setDialogo("editar"); }}><Pencil className="h-4 w-4" /></Button>
      </div>
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar producto…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-3">Producto</th><th className="px-2 py-2 text-right" title="Se usa para clientes sin clasificación o sin precio en su lista">General</th><th className="px-2 py-2">Precio de lista</th><th className="w-10" /></tr></thead>
        <tbody>{lista && precios !== undefined && productos.filter((p) => `${p.nombre} ${p.codigo}`.toLowerCase().includes(search.toLowerCase())).map((p) => {
          const fijo = precios.find((x) => x.lista_id === lista.id && x.producto_id === p.id);
          return <PrecioFila key={`${lista.id}-${p.id}-${fijo?.updated_at ?? "base"}`} listaId={lista.id} producto={p} precio={fijo?.precio} />;
        })}</tbody>
      </table></div>
    </> : !error && <p className="text-sm text-muted-foreground">Sin listas de precios.</p>}
    <Dialog open={dialogo !== null} onOpenChange={(v) => !v && setDialogo(null)}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>{dialogo === "crear" ? "Nueva lista de precios" : "Renombrar lista"}</DialogTitle></DialogHeader>
      <Label htmlFor="nombre-lista">Nombre de clasificación</Label><Input id="nombre-lista" placeholder="Ej. Supermercados" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <Button onClick={guardarLista} disabled={busy}>{busy ? "Guardando…" : "Guardar lista"}</Button>
    </DialogContent></Dialog>
  </div>;
}

function PrecioFila({ listaId, producto, precio }: { listaId: string; producto: { id: string; nombre: string; precio: number }; precio?: number }) {
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
    <td className="min-w-32 py-2 pr-3 font-medium">{producto.nombre}</td><td className="px-2 py-2 text-right"><PrecioGeneral key={`${producto.id}-${producto.precio}`} producto={producto} /></td>
    <td className="px-2 py-2"><Input type="number" min="0" step="0.01" className="w-32" aria-label={`Precio de ${producto.nombre}`} placeholder={`Base: ${producto.precio}`} value={valor} onChange={(e) => setValor(e.target.value)} /></td>
    <td><Button size="icon" variant="ghost" aria-label={`Guardar precio de ${producto.nombre}`} title="Guardar precio" disabled={busy || valor === (precio === undefined ? "" : String(precio))} onClick={guardar}><Save className="h-4 w-4" /></Button></td>
  </tr>;
}