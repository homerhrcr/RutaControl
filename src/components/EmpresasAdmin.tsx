import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { listEmpresas, guardarEmpresa } from "@/lib/usuarios.functions";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Empresa = { id: string; nombre: string; codigo: string; estado: string; miembros: number };

export function EmpresasAdmin() {
  const fetchEmpresas = useServerFn(listEmpresas);
  const guardar = useServerFn(guardarEmpresa);
  const qc = useQueryClient();
  const { refreshProfile } = useAuth();
  const { data = [], isLoading } = useQuery({ queryKey: ["empresas"], queryFn: () => fetchEmpresas() });
  const [editando, setEditando] = useState<Partial<Empresa> | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSave() {
    if (!editando?.nombre?.trim()) return;
    setSaving(true);
    try {
      await guardar({
        data: {
          id: editando.id,
          nombre: editando.nombre,
          estado: editando.estado === "inactive" ? "inactive" : "active",
        },
      });
      toast.success("Empresa guardada");
      setEditando(null);
      await qc.invalidateQueries({ queryKey: ["empresas"] });
      await refreshProfile();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold">Empresas</h2>
          <p className="text-xs text-muted-foreground">
            Para administrar los usuarios de una empresa, selecciónela en el menú y vaya a la pestaña Usuarios.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditando({ nombre: "", estado: "active" })}>
          <Plus className="mr-1 h-4 w-4" /> Nueva empresa
        </Button>
      </div>
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Dossier comercial de Ruta Directo</p>
          <p className="text-xs text-muted-foreground">PDF para presentar el sistema a nuevos clientes. Solo visible para el SuperAdmin.</p>
        </div>
        <Button size="sm" variant="outline" onClick={async () => {
          const { default: url } = await import("@/assets/dossier-comercial.pdf?url");
          window.open(url, "_blank");
        }}>Ver / descargar PDF</Button>
      </Card>
      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {data.map((e) => (
          <Card key={e.id} className="flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{e.nombre}</p>
              <p className="text-xs text-muted-foreground">
                {e.miembros} usuario(s) · {e.estado === "active" ? "Activa" : "Inactiva"}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setEditando(e)}>
              <Pencil className="h-4 w-4" />
            </Button>
          </Card>
        ))}
      </div>

      <Dialog open={!!editando} onOpenChange={(v) => !v && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando?.id ? "Editar empresa" : "Nueva empresa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input
                value={editando?.nombre ?? ""}
                onChange={(ev) => setEditando((p) => ({ ...p, nombre: ev.target.value }))}
              />
            </div>
            {editando?.id && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={editando.estado !== "inactive"}
                  onCheckedChange={(v) => setEditando((p) => ({ ...p, estado: v ? "active" : "inactive" }))}
                />
                <Label>Activa</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button onClick={onSave} disabled={saving}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
