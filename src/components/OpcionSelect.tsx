import { useOpciones, type CatalogoOpcionKey } from "@/lib/catalogos";
import { opcionesSelector } from "@/lib/catalogos-logica";

/** Selector nativo alimentado por un catálogo administrable. */
export function OpcionSelect({
  catalogo, value, onChange, vacio, className, id, ariaLabel, disabled,
}: {
  catalogo: CatalogoOpcionKey; value: string; onChange: (v: string) => void;
  /** Texto de la opción vacía; si se omite no hay opción vacía. */
  vacio?: string; className?: string; id?: string; ariaLabel?: string; disabled?: boolean;
}) {
  const { data = [] } = useOpciones(catalogo);
  const opciones = opcionesSelector(data, value);
  return (
    <select
      id={id}
      aria-label={ariaLabel}
      disabled={disabled}
      className={className ?? "h-10 w-full rounded-md border bg-background px-3 text-sm"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {vacio !== undefined && <option value="">{vacio}</option>}
      {opciones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
