import { useState } from "react";
import { useOpciones, type CatalogoOpcionKey } from "@/lib/catalogos";
import { opcionesSelector } from "@/lib/catalogos-logica";
import { useAuth } from "@/lib/auth";
import { Label } from "@/components/ui/label";
import { CatalogoDialog } from "@/components/CatalogSelect";

/**
 * Selector nativo alimentado por un catálogo administrable.
 * Si se indica `label`, muestra la etiqueta con el enlace «Administrar» (solo administradores).
 */
export function OpcionSelect({
  catalogo, value, onChange, vacio, className, id, ariaLabel, disabled, label,
}: {
  catalogo: CatalogoOpcionKey; value: string; onChange: (v: string) => void;
  /** Texto de la opción vacía; si se omite no hay opción vacía. */
  vacio?: string; className?: string; id?: string; ariaLabel?: string; disabled?: boolean;
  /** Etiqueta del campo; habilita el enlace «Administrar» para administradores. */
  label?: string;
}) {
  const { data = [] } = useOpciones(catalogo);
  const { isAdmin } = useAuth();
  const [admin, setAdmin] = useState(false);
  const opciones = opcionesSelector(data, value);
  const select = (
    <select
      id={id}
      aria-label={ariaLabel ?? label}
      disabled={disabled}
      className={className ?? "h-10 w-full rounded-md border bg-background px-3 text-sm"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {vacio !== undefined && <option value="">{vacio}</option>}
      {opciones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
  if (!label) return select;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        {isAdmin && (
          <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setAdmin(true)}>
            Administrar
          </button>
        )}
      </div>
      {select}
      <CatalogoDialog catalogo={catalogo} abierto={admin} cerrar={() => setAdmin(false)} />
    </div>
  );
}
