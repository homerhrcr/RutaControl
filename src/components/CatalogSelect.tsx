import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export type CatalogRow = { id: string; nombre: string };

/** Catálogos administrables desde cualquier campo de selección. */
export const CATALOGOS = {
  categorias: { table: "categorias", titulo: "Categorías de productos" },
  categorias_gasto: { table: "categorias_gasto", titulo: "Categorías de gastos" },
  rutas: { table: "rutas", titulo: "Rutas" },
} as const;

export type CatalogKey = keyof typeof CATALOGOS;

export function useCatalogo(catalogo: CatalogKey) {
  return useQuery({
    queryKey: ["catalogo", catalogo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(CATALOGOS[catalogo].table as any)
        .select("id, nombre")
        .order("nombre");
      if (error) throw error;
      return (data ?? []) as unknown as CatalogRow[];
    },
  });
}

/**
 * Campo de selección con administración en línea del catálogo:
 * permite agregar, renombrar y eliminar las opciones sin salir de la pantalla.
 */
export function CatalogSelect({
  catalogo,
  value,
  onChange,
  label,
  placeholder = "Seleccione una opción",
  /** Usa el nombre como valor en vez del id (para columnas de texto). */
  useNombre = false,
  /** Opciones fijas extra al inicio de la lista (por ejemplo "Todas"). */
  extraOptions = [],
  className,
  disabled,
  onRenamed,
}: {
  catalogo: CatalogKey;
  value: string;
  onChange: (v: string) => void;
  label?: string;
  placeholder?: string;
  useNombre?: boolean;
  extraOptions?: { value: string; label: string }[];
  className?: string;
  disabled?: boolean;
  onRenamed?: (anterior: string, nuevo: string) => void;
}) {
  const { data: items } = useCatalogo(catalogo);
  const [admin, setAdmin] = useState(false);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        {label ? <Label className="text-xs">{label}</Label> : <span />}
        <button
          type="button"
          className="text-xs font-medium text-primary hover:underline"
          onClick={() => setAdmin(true)}
        >
          Administrar
        </button>
      </div>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className={className}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {extraOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
          {(items ?? []).map((i) => (
            <SelectItem key={i.id} value={useNombre ? i.nombre : i.id}>
              {i.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <CatalogoDialog
        catalogo={catalogo}
        abierto={admin}
        cerrar={() => setAdmin(false)}
        onRenamed={(anterior, nuevo) => {
          if (useNombre && value === anterior) onChange(nuevo);
          onRenamed?.(anterior, nuevo);
        }}
      />
    </div>
  );
}

export function CatalogoDialog({
  catalogo,
  abierto,
  cerrar,
  onRenamed,
}: {
  catalogo: CatalogKey;
  abierto: boolean;
  cerrar: () => void;
  onRenamed?: (anterior: string, nuevo: string) => void;
}) {
  const { table, titulo } = CATALOGOS[catalogo];
  const { data: items } = useCatalogo(catalogo);
  const qc = useQueryClient();
  const [nueva, setNueva] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [busy, setBusy] = useState(false);

  function refrescar() {
    qc.invalidateQueries({ queryKey: ["catalogo", catalogo] });
    qc.invalidateQueries({ queryKey: ["categorias"] });
    qc.invalidateQueries({ queryKey: ["rutas"] });
    qc.invalidateQueries({ queryKey: ["productos"] });
    qc.invalidateQueries({ queryKey: ["gastos"] });
  }

  async function agregar() {
    const nombre = nueva.trim();
    if (!nombre) return toast.error("Escriba un nombre");
    if ((items ?? []).some((i) => i.nombre.toLowerCase() === nombre.toLowerCase()))
      return toast.error("Ya existe una opción con ese nombre");
    setBusy(true);
    const { error } = await supabase.from(table as any).insert({ nombre } as any);
    setBusy(false);
    if (error) return toast.error(error.message);
    setNueva("");
    refrescar();
    toast.success("Opción agregada");
  }

  async function guardar(item: CatalogRow) {
    const nombre = texto.trim();
    if (!nombre) return toast.error("Escriba un nombre");
    setBusy(true);
    const { error } = await supabase
      .from(table as any)
      .update({ nombre } as any)
      .eq("id", item.id);
    // Las columnas de texto (gastos.categoria) guardan el nombre: se actualizan también.
    if (!error && catalogo === "categorias_gasto")
      await supabase.from("gastos").update({ categoria: nombre }).eq("categoria", item.nombre);
    setBusy(false);
    if (error) return toast.error(error.message);
    setEditando(null);
    onRenamed?.(item.nombre, nombre);
    refrescar();
    toast.success("Opción actualizada");
  }

  async function borrar(item: CatalogRow) {
    setBusy(true);
    const { error } = await supabase.from(table as any).delete().eq("id", item.id);
    setBusy(false);
    if (error)
      return toast.error("No se puede eliminar: hay registros que la utilizan");
    refrescar();
    toast.success("Opción eliminada");
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(o) => {
        if (!o) {
          setEditando(null);
          cerrar();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            Agregue, renombre o elimine las opciones que utiliza su empresa. Al renombrar una
            opción se actualizan los registros que ya la usaban.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            placeholder="Nueva opción"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                agregar();
              }
            }}
          />
          <Button onClick={agregar} disabled={busy}>
            Agregar
          </Button>
        </div>

        <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
          {(items ?? []).map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/60">
              {editando === c.id ? (
                <>
                  <Input
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    className="h-8"
                    autoFocus
                  />
                  <Button size="sm" disabled={busy} onClick={() => guardar(c)}>
                    Guardar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{c.nombre}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditando(c.id);
                      setTexto(c.nombre);
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={busy}
                    onClick={() => borrar(c)}
                  >
                    Eliminar
                  </Button>
                </>
              )}
            </div>
          ))}
          {(items ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Sin opciones aún.</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setEditando(null);
              cerrar();
            }}
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
