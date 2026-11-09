import { useState } from "react";
import { useProductosCliente } from "@/lib/listas-precios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCRC } from "@/lib/format";
import { Trash2, Plus, ScanBarcode, Pencil } from "lucide-react";
import { EditarPrecioDialog } from "@/components/EditarPrecioDialog";
import { toast } from "sonner";
import { buscarPorCodigo, useLectorPistola, avisoLectura } from "@/lib/codigo-barras";
import { EscanerCamara } from "@/components/EscanerCamara";

export interface LineaItem {
  producto_id: string;
  nombre: string;
  precio: number;
  cantidad: number;
  precioOriginal?: number;
  precioModificado?: boolean;
  motivoModificacion?: string;
}

/** Selector simple de productos con cantidad. `extra` permite campos adicionales por línea. */
export function ItemsEditor<T extends LineaItem>({
  items,
  onChange,
  nuevo,
  extra,
  clienteId,
  rutaId,
  permitirSinPrecio,
  editarPrecio,
}: {
  /** Permite cambiar el precio de la línea solo para este pedido, con motivo. */
  editarPrecio?: boolean;
  items: T[];
  onChange: (items: T[]) => void;
  nuevo: (base: LineaItem) => T;
  extra?: (item: T, set: (patch: Partial<T>) => void) => React.ReactNode;
  clienteId?: string;
  rutaId?: string | null;
  /** Devoluciones: permite productos sin precio (precio 0). */
  permitirSinPrecio?: boolean;
}) {
  const { data: productos, listo, listaNombre } = useProductosCliente(clienteId, rutaId);
  const [sel, setSel] = useState("");
  const [camara, setCamara] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);

  function sumar(p: NonNullable<typeof productos>[number]) {
    if (!listo) return;
    if (!p.precioInfo.valido && !permitirSinPrecio) return toast.error(`${p.nombre}: ${p.precioInfo.mensaje}`);
    const idx = items.findIndex((x) => x.producto_id === p.id);
    if (idx >= 0) onChange(items.map((x, i) => (i === idx ? { ...x, cantidad: x.cantidad + 1 } : x)));
    else onChange([...items, nuevo({ producto_id: p.id, nombre: p.nombre, precio: p.precioInfo.valido ? Number(p.precio) : 0, cantidad: 1 })]);
  }

  function agregar() {
    const p = productos?.find((x) => x.id === sel);
    if (!p || !listo) return;
    if (!p.precioInfo.valido && !permitirSinPrecio) return toast.error(`${p.nombre}: ${p.precioInfo.mensaje}`);
    onChange([...items, nuevo({ producto_id: p.id, nombre: p.nombre, precio: p.precioInfo.valido ? Number(p.precio) : 0, cantidad: 1 })]);
    setSel("");
  }

  function porCodigo(codigo: string) {
    const p = buscarPorCodigo((productos ?? []) as any[], codigo) as NonNullable<typeof productos>[number] | undefined;
    if (!p) { avisoLectura(false); return toast.error(`Código ${codigo} no está registrado en ningún producto`); }
    avisoLectura(true);
    sumar(p);
  }
  useLectorPistola(listo && !camara, porCodigo);

  return (
    <div className="space-y-2">
      {clienteId && <p className="text-xs text-primary">{listaNombre}</p>}
      <div className="flex gap-2">
        <select className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm" value={sel} onChange={(e) => setSel(e.target.value)}>
          <option value="">Seleccionar producto…</option>
          {(productos ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.nombre} — {p.precioInfo.valido ? `${formatCRC(Number(p.precio))} · ${p.precioInfo.mensaje}` : "sin precio"}</option>
          ))}
        </select>
        <Button type="button" size="icon" variant="outline" onClick={() => setCamara(true)} disabled={!listo} aria-label="Leer código con la cámara"><ScanBarcode className="h-4 w-4" /></Button>
        <Button type="button" size="icon" onClick={agregar} disabled={!sel || !listo} aria-label="Agregar producto"><Plus className="h-4 w-4" /></Button>
      </div>
      <EscanerCamara open={camara} onClose={() => setCamara(false)} onCodigo={porCodigo} />
      {items.map((it, idx) => {
        const set = (patch: Partial<T>) => onChange(items.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
        return (
          <div key={idx} className="space-y-2 rounded-lg border p-2">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{it.nombre}</span>
              <Input type="number" min={0} step="any" inputMode="decimal" className="w-20" value={it.cantidad || ""} onChange={(e) => set({ cantidad: Number(e.target.value) || 0 } as Partial<T>)} />
              <span className="w-24 text-right text-sm">{formatCRC(it.precio * it.cantidad)}</span>
              <Button type="button" size="icon" variant="ghost" onClick={() => onChange(items.filter((_, i) => i !== idx))} aria-label="Quitar"><Trash2 className="h-4 w-4" /></Button>
            </div>
            {editarPrecio && (
              <button type="button" className="flex items-center gap-1 text-xs text-primary" onClick={() => setEditIdx(idx)}>
                <Pencil className="h-3 w-3" /> {formatCRC(it.precio)} c/u
                {it.precioModificado && <span className="rounded bg-warning/20 px-1 font-semibold text-warning">Modificado</span>}
              </button>
            )}
            {extra?.(it, set)}
          </div>
        );
      })}
      {editarPrecio && (
        <EditarPrecioDialog
          linea={editIdx !== null ? items[editIdx] ?? null : null}
          onClose={() => setEditIdx(null)}
          onGuardar={(l) => onChange(items.map((x, i) => (i === editIdx ? l : x)))}
        />
      )}
    </div>
  );
}
