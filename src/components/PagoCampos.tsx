import { useRef, useState } from "react";
import { useOpciones } from "@/lib/catalogos";
import { useAuth } from "@/lib/auth";
import { queueEvidencia } from "@/lib/offline";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatCRC } from "@/lib/format";
import { resumenPartes, sumaPartes, errorPartes, type PartePago } from "@/lib/pago-mixto";

/** En pago dividido, medio y referencia guardan el resumen del desglose. */
export type PagoDatos = { medio: string; referencia: string; archivo: File | null; partes?: PartePago[] };
export function errorPago(pago: PagoDatos, total: number) {
  return errorPartes(pago.partes, total);
}
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
export function PagoCampos({ value, onChange, total }: { value: PagoDatos; onChange: (v: PagoDatos) => void; total?: number }) {
  const { data = [] } = useOpciones("medio_pago");
  const opciones = data.filter((o) => o.activo || o.etiqueta === value.medio);
  const ref = useRef<HTMLInputElement>(null);
  const medio = value.medio || (opciones.find((o) => o.predeterminado) ?? opciones[0])?.etiqueta || "Efectivo";
  const electronico = !esEfectivo(medio);
  const etiquetas = opciones.length ? opciones.map((o) => o.etiqueta) : ["Efectivo"];
  const partes = value.partes && value.partes.length >= 2 ? value.partes : null;
  const setPartes = (ps: PartePago[]) => {
    if (ps.length < 2) {
      const p = ps[0];
      onChange({ ...value, partes: undefined, medio: p?.medio ?? medio, referencia: p?.referencia ?? "" });
      return;
    }
    const r = resumenPartes(ps);
    onChange({ ...value, partes: ps, medio: r.medio, referencia: r.referencia });
  };
  const agregar = () => {
    if (!partes) {
      const otro = etiquetas.find((e) => e !== medio) ?? medio;
      setPartes([
        { medio, monto: total ? String(total) : "", referencia: value.referencia },
        { medio: otro, monto: "", referencia: "" },
      ]);
    } else {
      const restante = Math.max(0, (total ?? 0) - sumaPartes(partes));
      setPartes([...partes, { medio: etiquetas.find((e) => !partes.some((p) => p.medio === e)) ?? etiquetas[0], monto: restante ? String(restante) : "", referencia: "" }]);
    }
  };
  const archivoBoton = (
    <>
      <input ref={ref} type="file" accept="image/*,application/pdf" capture="environment" className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > 15 * 1024 * 1024) { toast.error("El archivo debe pesar menos de 15 MB"); return; }
          onChange({ ...value, archivo: f });
        }} />
      <Button type="button" variant="outline" className="w-full gap-2" onClick={() => ref.current?.click()}>
        {value.archivo ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Camera className="h-4 w-4" />}
        {value.archivo ? `Comprobante: ${value.archivo.name}` : "Adjuntar foto o documento del comprobante"}
      </Button>
    </>
  );

  if (partes) {
    const suma = sumaPartes(partes);
    const dif = Math.round(((total ?? suma) - suma) * 100) / 100;
    return (
      <div className="space-y-2 rounded-lg border p-3">
        <Label className="text-xs text-muted-foreground">Formas de pago (pago dividido)</Label>
        {partes.map((p, i) => (
          <div key={i} className="space-y-1.5 rounded-md bg-muted/40 p-2">
            <div className="flex gap-2">
              <Select value={p.medio} onValueChange={(m) => setPartes(partes.map((x, j) => (j === i ? { ...x, medio: m } : x)))}>
                <SelectTrigger className="h-10 flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {etiquetas.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input className="h-10 w-28" type="number" inputMode="decimal" step="any" min="0" placeholder="Monto" value={p.monto}
                onChange={(e) => setPartes(partes.map((x, j) => (j === i ? { ...x, monto: e.target.value } : x)))} />
              <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0" aria-label="Quitar forma de pago"
                onClick={() => setPartes(partes.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {!esEfectivo(p.medio) && (
              <Input value={p.referencia} maxLength={120} placeholder="Número de referencia"
                onChange={(e) => setPartes(partes.map((x, j) => (j === i ? { ...x, referencia: e.target.value } : x)))} />
            )}
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="w-full gap-1" onClick={agregar}><Plus className="h-4 w-4" />Agregar otra forma de pago</Button>
        {total != null && (
          <div className="space-y-0.5 text-sm">
            <div className="flex justify-between"><span>Total a cobrar</span><span>{formatCRC(total)}</span></div>
            <div className="flex justify-between"><span>Suma ingresada</span><span>{formatCRC(suma)}</span></div>
            <div className={`flex justify-between font-semibold ${dif === 0 ? "text-primary" : "text-destructive"}`}>
              <span>{dif > 0 ? "Faltan" : dif < 0 ? "Sobran" : "Cuadrado"}</span><span>{formatCRC(Math.abs(dif))}</span>
            </div>
          </div>
        )}
        {partes.some((p) => !esEfectivo(p.medio)) && archivoBoton}
      </div>
    );
  }

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
          {archivoBoton}
        </>
      )}
      <Button type="button" variant="ghost" size="sm" className="w-full gap-1" onClick={agregar}><Plus className="h-4 w-4" />Agregar otra forma de pago</Button>
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
