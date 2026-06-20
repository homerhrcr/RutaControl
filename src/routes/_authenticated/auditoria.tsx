import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatCRC, formatDateTime } from "@/lib/format";
import { ChevronDown, ScrollText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/auditoria")({
  component: AuditoriaPage,
});

type Registro = {
  id: string;
  usuario_id: string | null;
  accion: string;
  entidad: string | null;
  detalle: any;
  fecha: string;
};

const ACCION_LABEL: Record<string, string> = {
  INSERT: "Creación",
  UPDATE: "Modificación",
  DELETE: "Eliminación",
};

const ENTIDAD_LABEL: Record<string, string> = {
  ventas: "Venta",
  abonos: "Abono",
};

function accionVariant(accion: string): "default" | "secondary" | "destructive" {
  if (accion === "DELETE") return "destructive";
  if (accion === "UPDATE") return "secondary";
  return "default";
}

function AuditoriaPage() {
  const { isAdmin } = useAuth();
  const [entidad, setEntidad] = useState<string>("todas");

  const { data, isLoading } = useQuery({
    queryKey: ["auditoria"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("auditoria")
        .select("id, usuario_id, accion, entidad, detalle, fecha")
        .in("entidad", ["ventas", "abonos"])
        .order("fecha", { ascending: false })
        .limit(500);
      if (error) throw error;

      const ids = Array.from(
        new Set((rows ?? []).map((r) => r.usuario_id).filter(Boolean)),
      ) as string[];
      const nameById = new Map<string, string>();
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nombre")
          .in("id", ids);
        for (const p of profs ?? []) nameById.set(p.id, p.nombre ?? "");
      }
      return (rows as Registro[]).map((r) => ({
        ...r,
        usuario: r.usuario_id ? nameById.get(r.usuario_id) ?? "Usuario" : "Sistema",
      }));
    },
  });

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Auditoría" subtitle="Registro de cambios" />
        <div className="p-4">
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Solo los administradores pueden ver la auditoría.
          </Card>
        </div>
      </div>
    );
  }

  const registros = (data ?? []).filter(
    (r) => entidad === "todas" || r.entidad === entidad,
  );

  return (
    <div>
      <PageHeader title="Auditoría" subtitle="Cambios en ventas y abonos" />
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <Select value={entidad} onValueChange={setEntidad}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="ventas">Ventas</SelectItem>
              <SelectItem value="abonos">Abonos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Cargando…
          </Card>
        ) : registros.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            <ScrollText className="mx-auto mb-2 h-8 w-8 opacity-50" />
            No hay registros de auditoría.
          </Card>
        ) : (
          <div className="space-y-2">
            {registros.map((r: any) => (
              <RegistroRow key={r.id} r={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RegistroRow({ r }: { r: any }) {
  const [open, setOpen] = useState(false);
  const detalle = r.detalle ?? {};
  const nuevo = detalle.nuevo ?? null;
  const anterior = detalle.anterior ?? null;
  const monto = nuevo?.total ?? nuevo?.monto ?? anterior?.total ?? anterior?.monto;

  return (
    <Card className="p-3">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-2">
              <Badge variant={accionVariant(r.accion)}>
                {ACCION_LABEL[r.accion] ?? r.accion}
              </Badge>
              <div>
                <div className="text-sm font-medium">
                  {ENTIDAD_LABEL[r.entidad] ?? r.entidad}
                  {monto != null && ` · ${formatCRC(Number(monto))}`}
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.usuario} · {formatDateTime(r.fecha)}
                </div>
              </div>
            </div>
            <ChevronDown
              className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {anterior && (
              <div>
                <div className="mb-1 text-xs font-semibold text-muted-foreground">
                  Antes
                </div>
                <pre className="overflow-x-auto rounded-md bg-muted p-2 text-xs">
                  {JSON.stringify(anterior, null, 2)}
                </pre>
              </div>
            )}
            {nuevo && (
              <div>
                <div className="mb-1 text-xs font-semibold text-muted-foreground">
                  Después
                </div>
                <pre className="overflow-x-auto rounded-md bg-muted p-2 text-xs">
                  {JSON.stringify(nuevo, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
