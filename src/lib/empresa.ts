import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type EmpresaDatos = {
  nombre: string;
  razonSocial: string;
  cedula: string;
  telefono: string;
  correo: string;
  direccion: string;
  web: string;
  logo: string | null;
  pie: string;
};

export function useEmpresa() {
  const { organizacionActiva } = useAuth();
  const orgId = organizacionActiva?.id;
  return useQuery({
    queryKey: ["empresa", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<EmpresaDatos> => {
      const { data } = await supabase.from("config_fiscal").select("*").maybeSingle();
      const d: any = data ?? {};
      const dir = [d.otras_senas, d.distrito, d.canton, d.provincia].filter(Boolean).join(", ");
      return {
        nombre: d.nombre_comercial || d.nombre_fiscal || organizacionActiva?.nombre || "Ruta Directo",
        razonSocial: d.nombre_fiscal || "",
        cedula: d.identificacion || "",
        telefono: d.telefono || "",
        correo: d.correo || "",
        direccion: dir,
        web: d.sitio_web || "",
        logo: d.logo_data || null,
        pie: d.pie_reportes || "",
      };
    },
  });
}
