import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { provincias, cantonesDe, distritosDe, cambiarProvincia, cambiarCanton, type DireccionTerritorial } from "@/lib/division-territorial";

const SIN_SELECCION = "__sin_seleccion__";

function Campo({ id, label, value, opciones, disabled, onChange }: {
  id: string; label: string; value: string; opciones: string[]; disabled?: boolean; onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || SIN_SELECCION} disabled={disabled} onValueChange={(v) => onChange(v === SIN_SELECCION ? "" : v)}>
        <SelectTrigger id={id} aria-label={label} className="w-full min-w-0 [&>span]:truncate">
          <SelectValue placeholder={`Seleccione ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SIN_SELECCION}>Sin seleccionar</SelectItem>
          {value && !opciones.includes(value) && <SelectItem value={value} disabled>{value} (revisar)</SelectItem>}
          {opciones.map((opcion) => <SelectItem key={opcion} value={opcion}>{opcion}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export function DireccionCliente({ value, onChange }: { value: DireccionTerritorial; onChange: (value: DireccionTerritorial) => void }) {
  const cantones = cantonesDe(value.provincia).map((c) => c.nombre);
  const distritos = distritosDe(value.provincia, value.canton);
  return (
    <div className="space-y-3">
      <Campo id="cliente-provincia" label="Provincia" value={value.provincia} opciones={provincias.map((p) => p.nombre)} onChange={(provincia) => onChange(cambiarProvincia(provincia))} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo id="cliente-canton" label="Cantón" value={value.canton} opciones={cantones} disabled={!cantones.length} onChange={(canton) => onChange(cambiarCanton(value, canton))} />
        <Campo id="cliente-distrito" label="Distrito" value={value.distrito} opciones={distritos} disabled={!distritos.length} onChange={(distrito) => onChange({ ...value, distrito })} />
      </div>
    </div>
  );
}