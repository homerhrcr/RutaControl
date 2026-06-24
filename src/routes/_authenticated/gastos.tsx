import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRutas, useInvalidate } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCRC } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Wallet, Plus, Pencil, Trash2, Fuel } from "lucide-react";

export const Route = createFileRoute("/_authenticated/gastos")({
  component: GastosPage,
});

const CATEGORIAS = ["viaticos", "combustible", "insumos", "otros"] as const;
const CAT_LABEL: Record<string, string> = {
  viaticos: "Viáticos",
  combustible: "Combustible",
  insumos: "Insumos",
  otros: "Otros",
};

type Gasto = {
  id: string;
  fecha: string;
  ruta_id: string | null;
  categoria: string;
  descripcion: string | null;
  monto: number;
};

function todayStr() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function GastosPage() {
  const { user } = useAuth();
  const { data: rutas } = useRutas();
  const invalidate = useInvalidate();
  const [fecha, setFecha] = useState(todayStr());
  const [rutaFiltro, setRutaFiltro] = useState<string>("all");
  const [editing, setEditing] = useState<Gasto | "new" | null>(null);
  const [deleting, setDeleting] = useState<Gasto | null>(null);

  const { data: gastos } = useQuery({
    queryKey: ["gastos", fecha, rutaFiltro],
    queryFn: async () => {
      const start = new Date(fecha + "T00:00:00");
      const end = new Date(fecha + "T23:59:59.999");
      let q = supabase
        .from("gastos")
        .select("id, fecha, ruta_id, categoria, descripcion, monto")
        .gte("fecha", start.toISOString())
        .lte("fecha", end.toISOString())
        .order("fecha", { ascending: false });
      if (rutaFiltro !== "all") q = q.eq("ruta_id", rutaFiltro);
      const { data, error } = await q;
      if (error) throw error;
      return data as Gasto[];
    },
  });

  const total = useMemo(
    () => (gastos ?? []).reduce((s, g) => s + Number(g.monto), 0),
    [gastos],
  );

  const porCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    for (const g of gastos ?? [])
      map[g.categoria] = (map[g.categoria] ?? 0) + Number(g.monto);
    return map;
  }, [gastos]);

  function refresh() {
    invalidate(["gastos", "gastos-resumen", "dashboard", "reportes"]);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const { error } = await supabase.from("gastos").delete().eq("id", deleting.id);
    if (error) return toast.error(error.message);
    toast.success("Gasto eliminado");
    setDeleting(null);
    refresh();
  }

  const rutaNombre = (id: string | null) =>
    rutas?.find((r) => r.id === id)?.nombre ?? "General";

  return (
    <div>
      <PageHeader title="Gastos" subtitle="Gastos del día de la ruta" />
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Fecha</Label>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-44"
            />
          </div>
          <div>
            <Label className="text-xs">Ruta</Label>
            <Select value={rutaFiltro} onValueChange={setRutaFiltro}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Ruta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las rutas</SelectItem>
                {rutas?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="ml-auto gap-1.5" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Nuevo gasto
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Card className="p-3">
            <div className="mb-2 grid h-9 w-9 place-items-center rounded-lg bg-destructive/15 text-destructive">
              <Wallet className="h-5 w-5" />
            </div>
            <p className="text-xs text-muted-foreground">Total gastos</p>
            <p className="truncate text-lg font-black">{formatCRC(total)}</p>
          </Card>
          {CATEGORIAS.map((c) => (
            <Card key={c} className="p-3">
              <div className="mb-2 grid h-9 w-9 place-items-center rounded-lg bg-warning/20 text-warning">
                <Fuel className="h-5 w-5" />
              </div>
              <p className="text-xs text-muted-foreground">{CAT_LABEL[c]}</p>
              <p className="truncate text-lg font-black">
                {formatCRC(porCategoria[c] ?? 0)}
              </p>
            </Card>
          ))}
        </div>

        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Categoría</th>
                <th className="px-4 py-2.5 font-medium">Descripción</th>
                <th className="px-4 py-2.5 font-medium">Ruta</th>
                <th className="px-4 py-2.5 text-right font-medium">Monto</th>
                <th className="px-4 py-2.5 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(gastos ?? []).map((g) => (
                <tr key={g.id} className="border-b border-border/50">
                  <td className="px-4 py-2.5 font-medium">
                    {CAT_LABEL[g.categoria] ?? g.categoria}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {g.descripcion || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs">{rutaNombre(g.ruta_id)}</td>
                  <td className="px-4 py-2.5 text-right font-bold">
                    {formatCRC(Number(g.monto))}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditing(g)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleting(g)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {(gastos ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-muted-foreground">
                    No hay gastos registrados para esta selección.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <GastoDialog
        gasto={editing}
        rutas={rutas ?? []}
        defaultFecha={fecha}
        userId={user?.id}
        defaultRuta={rutaFiltro !== "all" ? rutaFiltro : null}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refresh();
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar gasto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function GastoDialog({
  gasto,
  rutas,
  defaultFecha,
  defaultRuta,
  userId,
  onClose,
  onSaved,
}: {
  gasto: Gasto | "new" | null;
  rutas: { id: string; nombre: string }[];
  defaultFecha: string;
  defaultRuta: string | null;
  userId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = gasto === "new";
  const existing = gasto && gasto !== "new" ? gasto : null;
  const [categoria, setCategoria] = useState("otros");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [rutaId, setRutaId] = useState<string>("none");
  const [saving, setSaving] = useState(false);

  // sync state when dialog opens
  const open = gasto !== null;
  const key = existing?.id ?? (isNew ? "new" : "");
  useMemo(() => {
    if (!open) return;
    setCategoria(existing?.categoria ?? "otros");
    setDescripcion(existing?.descripcion ?? "");
    setMonto(existing ? String(existing.monto) : "");
    setRutaId(existing?.ruta_id ?? defaultRuta ?? "none");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  async function save() {
    const m = Number(monto);
    if (!m || m <= 0) return toast.error("Ingrese un monto válido");
    setSaving(true);
    const payload = {
      categoria,
      descripcion: descripcion || null,
      monto: m,
      ruta_id: rutaId === "none" ? null : rutaId,
    };
    let error;
    if (existing) {
      ({ error } = await supabase.from("gastos").update(payload).eq("id", existing.id));
    } else {
      ({ error } = await supabase.from("gastos").insert({
        ...payload,
        usuario_id: userId ?? null,
        fecha: new Date(defaultFecha + "T12:00:00").toISOString(),
      }));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(existing ? "Gasto actualizado" : "Gasto agregado");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Editar gasto" : "Nuevo gasto"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Categoría</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CAT_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Ruta</Label>
            <Select value={rutaId} onValueChange={setRutaId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">General (sin ruta)</SelectItem>
                {rutas.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Monto</Label>
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Descripción</Label>
            <Textarea
              placeholder="Detalle del gasto…"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving} className={cn(saving && "opacity-70")}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
