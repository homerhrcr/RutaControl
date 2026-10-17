import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, Save, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const CAMPOS = {
  nombre_comercial: "", nombre_fiscal: "", tipo_identificacion: "02", identificacion: "",
  telefono: "", correo: "", sitio_web: "", provincia: "", canton: "", distrito: "",
  otras_senas: "", pie_reportes: "", logo_data: "",
};
type F = typeof CAMPOS;

/** Reduce el logo a máx. 400 px y lo guarda como PNG para encabezados de reportes. */
async function prepararLogo(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, 400 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function EmpresaPerfil() {
  const { organizacionActiva } = useAuth();
  const orgId = organizacionActiva?.id;
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const { data } = useQuery({
    queryKey: ["config_fiscal", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("config_fiscal").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [f, setF] = useState<F>(CAMPOS);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!data) return;
    const d: any = data;
    setF(Object.fromEntries(Object.keys(CAMPOS).map((k) => [k, d[k] ?? (CAMPOS as any)[k]])) as F);
  }, [data]);

  async function guardar() {
    if (!orgId) return;
    if (!f.nombre_comercial.trim() && !f.nombre_fiscal.trim()) return toast.error("Indica el nombre de la empresa");
    setBusy(true);
    const { error } = await supabase
      .from("config_fiscal")
      .upsert({ ...f, logo_data: f.logo_data || null, organization_id: orgId } as never);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Datos de la empresa guardados");
    qc.invalidateQueries({ queryKey: ["config_fiscal"] });
    qc.invalidateQueries({ queryKey: ["empresa"] });
  }

  async function subirLogo(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Selecciona una imagen");
    try {
      setF((p) => ({ ...p, logo_data: "" }));
      const logo = await prepararLogo(file);
      setF((p) => ({ ...p, logo_data: logo }));
      toast.info("Logo listo. Recuerda guardar.");
    } catch {
      toast.error("No se pudo leer la imagen");
    }
  }

  const campo = (k: keyof F, label: string, extra?: object) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...extra} />
    </div>
  );

  return (
    <Card className="space-y-5 p-4">
      <div>
        <h2 className="font-bold">Datos de la empresa</h2>
        <p className="text-sm text-muted-foreground">Aparecen en el encabezado de todos los reportes PDF y Excel.</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="grid h-24 w-40 place-items-center overflow-hidden rounded-lg border bg-card">
          {f.logo_data ? (
            <img src={f.logo_data} alt="Logo de la empresa" className="max-h-full max-w-full object-contain" />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => subirLogo(e.target.files?.[0])} />
          <Button variant="outline" size="sm" onClick={() => input.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> Subir logo
          </Button>
          {f.logo_data && (
            <Button variant="ghost" size="sm" onClick={() => setF({ ...f, logo_data: "" })}>
              <Trash2 className="mr-2 h-4 w-4" /> Quitar
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {campo("nombre_comercial", "Nombre comercial")}
        {campo("nombre_fiscal", "Razón social")}
        {campo("identificacion", "Cédula jurídica / física")}
        {campo("telefono", "Teléfono", { type: "tel" })}
        {campo("correo", "Correo electrónico", { type: "email" })}
        {campo("sitio_web", "Sitio web")}
        {campo("provincia", "Provincia")}
        {campo("canton", "Cantón")}
        {campo("distrito", "Distrito")}
        {campo("otras_senas", "Otras señas")}
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Pie de página de reportes</Label>
        <Textarea rows={2} value={f.pie_reportes} placeholder="Ej.: Documento de uso interno" onChange={(e) => setF({ ...f, pie_reportes: e.target.value })} />
      </div>
      <Button onClick={guardar} disabled={busy}>
        <Save className="mr-2 h-4 w-4" /> {busy ? "Guardando…" : "Guardar"}
      </Button>
    </Card>
  );
}
