import { useEffect, useRef, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ClienteOrden {
  id: string;
  nombre: string;
  distrito?: string | null;
  direccion?: string | null;
}

export function OrdenRuta({ clientes, disabled, onMove }: {
  clientes: ClienteOrden[];
  disabled: boolean;
  onMove: (id: string, posicion: number) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function onDragEnd({ active, over }: DragEndEvent) {
    if (disabled || !over || active.id === over.id) return;
    const destino = clientes.findIndex((c) => c.id === over.id);
    if (destino >= 0) onMove(String(active.id), destino + 1);
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={clientes.map((c) => c.id)} strategy={rectSortingStrategy}>
        <div className="grid gap-1.5 lg:grid-cols-2">
          {clientes.map((cliente, index) => (
            <ClienteSortable key={cliente.id} cliente={cliente} posicion={index + 1} total={clientes.length} disabled={disabled} onMove={onMove} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function ClienteSortable({ cliente, posicion, total, disabled, onMove }: {
  cliente: ClienteOrden;
  posicion: number;
  total: number;
  disabled: boolean;
  onMove: (id: string, posicion: number) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: cliente.id, disabled });
  const [numero, setNumero] = useState(String(posicion));
  const editado = useRef(false);
  useEffect(() => setNumero(String(posicion)), [posicion]);
  function confirmar() {
    if (!editado.current) return;
    editado.current = false;
    const value = Number(numero);
    if (numero.trim() && Number.isInteger(value)) onMove(cliente.id, value);
    setNumero(String(posicion));
  }
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("relative min-w-0", isDragging && "z-10")}>
      <Card className={cn("flex items-center gap-1.5 p-1.5", isDragging && "border-primary bg-muted shadow-lg ring-1 ring-primary")}>
        <Button ref={setActivatorNodeRef} {...attributes} {...listeners} variant="ghost" size="icon" disabled={disabled}
          aria-label={`Arrastrar ${cliente.nombre}`} title="Arrastrar para ordenar"
          className="h-9 w-8 shrink-0 touch-none cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4" />
        </Button>
        <Input type="number" inputMode="numeric" min={1} max={total} step={1} value={numero} disabled={disabled}
          aria-label={`Posición de ${cliente.nombre}`} className="h-8 w-14 shrink-0 px-1 text-center text-xs font-bold"
          onChange={(e) => { editado.current = true; setNumero(e.target.value); }} onBlur={confirmar}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
            if (e.key === "Escape") { editado.current = false; setNumero(String(posicion)); }
          }} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{cliente.nombre}</p>
          <p className="truncate text-[11px] leading-tight text-muted-foreground">{cliente.distrito || cliente.direccion || "Sin dirección"}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={disabled || posicion === 1}
            onClick={() => onMove(cliente.id, posicion - 1)} aria-label={`Subir ${cliente.nombre}`} title="Subir">
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={disabled || posicion === total}
            onClick={() => onMove(cliente.id, posicion + 1)} aria-label={`Bajar ${cliente.nombre}`} title="Bajar">
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      </Card>
    </div>
  );
}