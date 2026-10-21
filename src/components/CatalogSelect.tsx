import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
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
import { CatalogoEditor } from "@/components/CatalogosAdmin";
import { DEFINICIONES, type CatalogoOpcionKey } from "@/lib/catalogos";

export type CatalogRow = { id: string; nombre: string; activo: boolean; orden: number };

/** Catálogos administrables desde cualquier campo de selección. */
export const CATALOGOS = {
  categorias: { table: "categorias", titulo: "Categorías de productos" },
  categorias_gasto: { table: "categorias_gasto", titulo: "Categorías de gastos" },
  rutas: { table: "rutas", titulo: "Rutas" },
} as const;

export type CatalogKey = keyof typeof CATALOGOS;

/** Todas las opciones (activas e inactivas) ordenadas por el orden definido por el administrador. */
export function useCatalogo(catalogo: CatalogKey) {
  return useQuery({
    queryKey: ["catalogo", catalogo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(CATALOGOS[catalogo].table as any)
        .select("id, nombre, activo, orden")
        .order("orden")
        .order("nombre");
      if (error) throw error;
      return (data ?? []) as unknown as CatalogRow[];
    },
  });
}

/**
 * Campo de selección con administración en línea del catálogo.
 * Solo ofrece opciones activas, pero conserva el valor ya guardado aunque esté inactivo.
 */
export function CatalogSelect({
  catalogo,
  value,
  onChange,
  label,
  placeholder = "Seleccione una opción",
  useNombre = false,
  extraOptions = [],
  className,
  disabled,
  onRenamed,
  incluirInactivas = false,
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
  /** Para filtros de búsqueda: muestra también las inactivas. */
  incluirInactivas?: boolean;
}) {
  const { data: items } = useCatalogo(catalogo);
  const { isAdmin } = useAuth();
  const [admin, setAdmin] = useState(false);
  const visibles = (items ?? []).filter((i) => incluirInactivas || i.activo || (useNombre ? i.nombre : i.id) === value);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        {label ? <Label className="text-xs">{label}</Label> : <span />}
        {isAdmin && (
          <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setAdmin(true)}>
            Administrar
          </button>
        )}
      </div>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className={className}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {extraOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
          {visibles.map((i) => (
            <SelectItem key={i.id} value={useNombre ? i.nombre : i.id}>
              {i.nombre}{i.activo ? "" : " (inactiva)"}
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
  catalogo: CatalogKey | CatalogoOpcionKey;
  abierto: boolean;
  cerrar: () => void;
  onRenamed?: (anterior: string, nuevo: string) => void;
}) {
  const def = DEFINICIONES.find((d) => d.key === catalogo)!;
  return (
    <Dialog open={abierto} onOpenChange={(o) => { if (!o) cerrar(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{def.titulo}</DialogTitle>
          <DialogDescription>
            Agregue, renombre, ordene, active o desactive las opciones. Las opciones desactivadas no se ofrecen en registros nuevos; los registros anteriores se conservan.
          </DialogDescription>
        </DialogHeader>
        <CatalogoEditor def={def} onRenamed={onRenamed} />
        <DialogFooter>
          <Button variant="outline" onClick={cerrar}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
