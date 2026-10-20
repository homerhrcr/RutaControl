import { useState } from "react";
import { useProductosCliente } from "@/lib/listas-precios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCRC } from "@/lib/format";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export interface LineaItem {
  producto_id: string;
  nombre: string;
  precio: number;
  cantidad: number;
}

/** Selector simple de productos con cantidad. `extra` permite campos adicionales por línea. */
export function ItemsEditor<T extends LineaItem>({
  items,
  onChange,
  nuevo,
  extra,
  clienteId,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  nuevo: (base: LineaItem) => T;
  extra?: (item: T, set: (patch: Partial<T>) => void) => React.ReactNode;
  clienteId?: string;
}) {
  const { data: productos, listo, listaNombre } = useProductosCliente(clienteId);
  const [sel, setSel] = useState("");

  function agregar() {
    const p = productos?.find((x) => x.id === sel);
    if (!p || !listo) return;
    if (!(Number(p.precio) > 0)) return toast.error(`${p.nombre} no tiene precio para la clasificación de este cliente`);
    onChange([...items, nuevo({ producto_id: p.id, nombre: p.nombre, precio: Number(p.precio), cantidad: 1 })]);
    setSel("");
  }

  return (
    <div className="space-y-2">
      {clienteId && <p className="text-xs text-primary">{listaNombre}</p>}
      <div className="flex gap-2">
        <select className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm" value={sel} onChange={(e) => setSel(e.target.value)}>
          <option value="">Seleccionar producto…</option>
          {(productos ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.nombre} — {Number(p.precio) > 0 ? formatCRC(Number(p.precio)) : "sin precio"}</option>
          ))}
        </select>
        <Button type="button" size="icon" onClick={agregar} disabled={!sel || !listo} aria-label="Agregar producto"><Plus className="h-4 w-4" /></Button>
      </div>
      {items.map((it, idx) => {
        const set = (patch: Partial<T>) => onChange(items.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
        return (
          <div key={idx} className="space-y-2 rounded-lg border p-2">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{it.nombre}</span>
              <Input type="number" min={0} className="w-20" value={it.cantidad || ""} onChange={(e) => set({ cantidad: Number(e.target.value) || 0 } as Partial<T>)} />
              <span className="w-24 text-right text-sm">{formatCRC(it.precio * it.cantidad)}</span>
              <Button type="button" size="icon" variant="ghost" onClick={() => onChange(items.filter((_, i) => i !== idx))} aria-label="Quitar"><Trash2 className="h-4 w-4" /></Button>
            </div>
            {extra?.(it, set)}
          </div>
        );
      })}
    </div>
  );
}
