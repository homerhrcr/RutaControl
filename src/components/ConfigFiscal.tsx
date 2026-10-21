import { OpcionSelect } from "@/components/OpcionSelect";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const vacio = {
  tipo_identificacion: "02", identificacion: "", nombre_fiscal: "", nombre_comercial: "",
  actividad_economica: "", correo: "", telefono: "", provincia: "", canton: "", distrito: "",
  otras_senas: "", sucursal: "001", terminal: "00001", ambiente: "staging", activo: false,
};

export function ConfigFiscal() {
  const { organizacionActiva } = useAuth();
  const qc = useQueryClient();
  const orgId = organizacionActiva?.id;
  const { data } = useQuery({
    queryKey: ["config_fiscal", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("config_fiscal").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [f, setF] = useState<typeof vacio>(vacio);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) setF({ ...vacio, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v ?? ""])) } as typeof vacio);
  }, [data]);

  async function guardar() {
    if (!orgId) return;
    setBusy(true);
    const { error } = await supabase.from("config_fiscal").upsert({ ...f, organization_id: orgId });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Datos fiscales guardados");
    qc.invalidateQueries({ queryKey: ["config_fiscal"] });
  }

  const campo = (k: keyof typeof vacio, label: string, extra?: object) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={String(f[k] ?? "")} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...extra} />
    </div>
  );

  return (
    <Card className="mt-4 space-y-4 p-4">
      <div>
        <h2 className="font-bold">Facturación electrónica (Hacienda 4.4)</h2>
        <p className="text-sm text-muted-foreground">
          Datos del emisor para {organizacionActiva?.nombre}. El certificado (.p12), su PIN y el usuario de Hacienda se cargan de forma segura aparte.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <OpcionSelect catalogo="tipo_identificacion" label="Tipo de cédula" ariaLabel="Tipo de cédula" value={f.tipo_identificacion} onChange={(v) => setF({ ...f, tipo_identificacion: v })} />
        {campo("identificacion", "Cédula")}
        {campo("nombre_fiscal", "Nombre o razón social")}
        {campo("nombre_comercial", "Nombre comercial")}
        {campo("actividad_economica", "Código de actividad económica")}
        {campo("correo", "Correo", { type: "email" })}
        {campo("telefono", "Teléfono")}
        {campo("provincia", "Provincia (código)")}
        {campo("canton", "Cantón (código)")}
        {campo("distrito", "Distrito (código)")}
        {campo("otras_senas", "Otras señas")}
        {campo("sucursal", "Sucursal")}
        {campo("terminal", "Terminal")}
        <div className="space-y-1">
          <Label className="text-xs">Ambiente</Label>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={f.ambiente} onChange={(e) => setF({ ...f, ambiente: e.target.value })}>
            <option value="staging">Pruebas</option><option value="produccion">Producción</option>
          </select>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <Label>Emitir comprobantes electrónicos</Label>
        <Switch checked={!!f.activo} onCheckedChange={(v) => setF({ ...f, activo: v })} />
      </div>
      <Button disabled={busy} onClick={guardar}>{busy ? "Guardando…" : "Guardar"}</Button>
    </Card>
  );
}
