import { useRef, useState } from "react";
import { useOpciones } from "@/lib/catalogos";
import { useAuth } from "@/lib/auth";
import { queueEvidencia } from "@/lib/offline";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export type PagoDatos = { medio: string; referencia: string; archivo: File | null };
export const pagoVacio: PagoDatos = { medio: "", referencia: "", archivo: null };

/** Etiqueta de la forma de pago que se toma por defecto (la predeterminada del catálogo o Efectivo). */
export function useMedioPredeterminado() {
  const { data = [] } = useOpciones("medio_pago");
  const activos = data.filter((o) => o.activo);
  return (activos.find((o) => o.predeterminado) ?? activos[0])?.etiqueta ?? "Efectivo";
}

export function esEfectivo(medio: string) {
  return /efectivo/i.test(medio);
}

/** Forma de pago, número de referencia y foto/documento del comprobante. */
export function PagoCampos({ value, onChange }: { value: PagoDatos; onChange: (v: PagoDatos) => void }) {
  const { data = [] } = useOpciones("medio_pago");
  const opciones = data.filter((o) => o.activo || o.etiqueta === value.medio);
  const ref = useRef<HTMLInputElement>(null);
  const medio = value.medio || (opciones.find((o) => o.predeterminado) ?? opciones[0])?.etiqueta || "Efectivo";
  const electronico = !esEfectivo(medio);
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Forma de pago</Label>
        <Select value={medio} onValueChange={(m) => onChange({ ...value, medio: m })}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(opciones.length ? opciones.map((o) => o.etiqueta) : ["Efectivo"]).map((e) => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {electronico && (
        <>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Número de referencia</Label>
            <Input value={value.referencia} maxLength={120} placeholder="Ej.: 2026110512345" onChange={(e) => onChange({ ...value, medio, referencia: e.target.value })} />
          </div>
          <input ref={ref} type="file" accept="image/*,application/pdf" capture="environment" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 15 * 1024 * 1024) { toast.error("El archivo debe pesar menos de 15 MB"); return; }
              onChange({ ...value, medio, archivo: f });
            }} />
          <Button type="button" variant="outline" className="w-full gap-2" onClick={() => ref.current?.click()}>
            {value.archivo ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Camera className="h-4 w-4" />}
            {value.archivo ? `Comprobante: ${value.archivo.name}` : "Adjuntar foto o documento del comprobante"}
          </Button>
        </>
      )}
    </div>
  );
}

/** Guarda el comprobante adjunto (funciona sin conexión; se sube al reconectar). */
export function useGuardarComprobante() {
  const { user, organizacionActiva } = useAuth();
  return async (archivo: File | null, entidad: "ventas" | "abonos", entidadId: string) => {
    if (!archivo || !user || !organizacionActiva) return;
    try {
      await queueEvidencia({ file: archivo, nombre: `Comprobante de pago — ${archivo.name}`, entidad, entidad_id: entidadId, usuario_id: user.id, organization_id: organizacionActiva.id });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el comprobante");
    }
  };
}
