import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProductos, useRutas } from "@/lib/data";
import { usePreciosEspeciales } from "@/lib/listas-precios";
import { validarPrecio, fechaComercial } from "@/lib/precios";
import { formatCRC } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Power } from "lucide-react";
import { toast } from "sonner";

/** Precios negociados con un cliente: para todas las rutas o solo una ruta, con vigencia. */
export function PreciosEspecialesCliente({ clienteId }: { clienteId: string }) {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data: todos = [] } = usePreciosEspeciales();
  const { data: productos = [] } = useProductos();
  const { data: rutas = [] } = useRutas();
  const hoy = fechaComercial();
  const [f, setF] = useState({ producto_id: "", ruta_id: "", precio: "", fecha_inicio: hoy, fecha_fin: "" });
  const [busy, setBusy] = useState(false);
  const lista = todos.filter((e) => e.cliente_id === clienteId);
  const refrescar = () => qc.invalidateQueries({ queryKey: ["precios_especiales"] });

  async function agregar() {
    let precio: number | null;
    try { precio = validarPrecio(f.precio); } catch (e) { return toast.error((e as Error).message); }
    if (!f.producto_id || precio === null) return toast.error("Seleccione producto y precio");
    if (f.fecha_fin && f.fecha_fin < f.fecha_inicio) return toast.error("La fecha final debe ser posterior a la inicial");
    setBusy(true);
    const { error } = await supabase.from("precios_especiales").insert({ cliente_id: clienteId, producto_id: f.producto_id, ruta_id: f.ruta_id || null, precio, fecha_inicio: f.fecha_inicio, fecha_fin: f.fecha_fin || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    setF({ ...f, producto_id: "", precio: "" });
    await refrescar();
    toast.success("Precio especial guardado");
  }
  async function alternar(id: string, activo: boolean) {
    const { error } = await supabase.from("precios_especiales").update({ activo: !activo }).eq("id", id);
    if (error) return toast.error(error.message);
    await refrescar();
  }
  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este precio especial?")) return;
    const { error } = await supabase.from("precios_especiales").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await refrescar();
  }
  const estado = (e: (typeof lista)[number]) => !e.activo ? "Inactivo" : e.fecha_inicio > hoy ? "Programado" : e.fecha_fin && e.fecha_fin < hoy ? "Vencido" : "Vigente";

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-sm font-semibold">Precios especiales</p>
      {lista.length === 0 && <p className="text-xs text-muted-foreground">Sin precios especiales: se usa la lista de la ruta.</p>}
      {lista.map((e) => (
        <div key={e.id} className="flex items-center gap-2 text-xs">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{productos.find((p) => p.id === e.producto_id)?.nombre ?? "Producto"} · {formatCRC(Number(e.precio))}</p>
            <p className="text-muted-foreground">{e.ruta_id ? `Solo ${rutas.find((r) => r.id === e.ruta_id)?.nombre ?? "ruta"}` : "Todas las rutas"} · {e.fecha_inicio} → {e.fecha_fin ?? "sin fin"}</p>
          </div>
          <Badge variant={estado(e) === "Vigente" ? "secondary" : "outline"}>{estado(e)}</Badge>
          {isAdmin && <>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label={e.activo ? "Desactivar" : "Activar"} onClick={() => alternar(e.id, e.activo)}><Power className="h-4 w-4" /></Button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Eliminar precio especial" onClick={() => eliminar(e.id)}><Trash2 className="h-4 w-4" /></Button>
          </>}
        </div>
      ))}
      {isAdmin && <div className="grid grid-cols-2 gap-2 border-t pt-2">
        <select aria-label="Producto del precio especial" className="col-span-2 h-9 rounded-md border bg-background px-2 text-sm" value={f.producto_id} onChange={(e) => setF({ ...f, producto_id: e.target.value })}>
          <option value="">Producto…</option>
          {productos.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}
        </select>
        <select aria-label="Alcance del precio especial" className="h-9 rounded-md border bg-background px-2 text-sm" value={f.ruta_id} onChange={(e) => setF({ ...f, ruta_id: e.target.value })}>
          <option value="">Todas las rutas</option>
          {rutas.filter((r) => r.activo || r.id === f.ruta_id).map((r) => <option key={r.id} value={r.id}>Solo {r.nombre}</option>)}
        </select>
        <Input aria-label="Precio especial" type="number" min="0" step="0.01" placeholder="Precio" className="h-9" value={f.precio} onChange={(e) => setF({ ...f, precio: e.target.value })} />
        <Input aria-label="Vigente desde" type="date" className="h-9" value={f.fecha_inicio} onChange={(e) => setF({ ...f, fecha_inicio: e.target.value })} />
        <Input aria-label="Vigente hasta" type="date" className="h-9" value={f.fecha_fin} onChange={(e) => setF({ ...f, fecha_fin: e.target.value })} />
        <Button type="button" size="sm" className="col-span-2" disabled={busy} onClick={agregar}><Plus className="mr-1 h-4 w-4" />Agregar precio especial</Button>
      </div>}
    </div>
  );
}
