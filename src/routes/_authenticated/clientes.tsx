import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClientes, useRutas, useInvalidate, eliminarCliente } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { toast } from "sonner";
import { Plus, Search, MapPin, Phone, MessageCircle, History, Trash2 } from "lucide-react";
import { HistorialCliente } from "@/components/HistorialCliente";
import { ClienteUbicacion } from "@/components/ClienteUbicacion";
import { leerCoordenadas } from "@/lib/coordenadas";
import { DireccionCliente } from "@/components/DireccionCliente";
import { normalizarDireccion, errorDireccion } from "@/lib/division-territorial";
import { TelegramCliente } from "@/components/TelegramCliente";


export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Ruta Directo" },
      { name: "description", content: "Clientes y su historial comercial en Ruta Directo." },
      { property: "og:title", content: "Clientes — Ruta Directo" },
      { property: "og:description", content: "Clientes y su historial comercial en Ruta Directo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClientesPage,
});

const empty = {
  nombre: "",
  telefono: "",
  direccion: "",
  distrito: "",
  canton: "",
  provincia: "",
  referencia: "",
  tipo_identificacion: "",
  identificacion: "",
  correo_fe: "",
  ruta_ids: [] as string[],
  latitud: "",
  longitud: "",
};

function ClientesPage() {
  const { isAdmin } = useAuth();
  const { data: clientes } = useClientes();
  const { data: rutas } = useRutas();
  const invalidate = useInvalidate();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [histCliente, setHistCliente] = useState<{ id: string; nombre: string } | null>(null);
  const [delCliente, setDelCliente] = useState<{ id: string; nombre: string } | null>(null);

  async function confirmarEliminar() {
    if (!delCliente) return;
    try {
      await eliminarCliente(delCliente.id);
      toast.success("Cliente eliminado");
      invalidate(["clientes"]);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al eliminar");
    } finally {
      setDelCliente(null);
    }
  }


  const filtered = useMemo(
    () => (clientes ?? []).filter((c) => c.nombre.toLowerCase().includes(search.toLowerCase())),
    [clientes, search],
  );

  function openNew() {
    setForm(empty);
    setEditId(null);
    setOpen(true);
  }
  function openEdit(c: any) {
    setForm({
      nombre: c.nombre ?? "",
      telefono: c.telefono ?? "",
      direccion: c.direccion ?? "",
      ...normalizarDireccion({ distrito: c.distrito ?? "", canton: c.canton ?? "", provincia: c.provincia ?? "" }),
      referencia: c.referencia ?? "",
      tipo_identificacion: c.tipo_identificacion ?? "",
      identificacion: c.identificacion ?? "",
      correo_fe: c.correo_fe ?? "",
      ruta_ids: (c.cliente_rutas ?? []).map((cr: any) => cr.ruta_id),
      latitud: c.latitud != null ? String(c.latitud) : "",
      longitud: c.longitud != null ? String(c.longitud) : "",
    });
    setEditId(c.id);
    setOpen(true);
  }

  async function save() {
    if (!form.nombre.trim()) return toast.error("El nombre es obligatorio");
    const errorTerritorial = errorDireccion(form);
    if (errorTerritorial) return toast.error(errorTerritorial);
    let ubicacion;
    try { ubicacion = leerCoordenadas(form.latitud, form.longitud); }
    catch (e) { return toast.error(e instanceof Error ? e.message : "Coordenadas inválidas"); }
    setBusy(true);
    const { ruta_ids, ...rest } = form;
    const payload = { ...rest, latitud: ubicacion?.lat ?? null, longitud: ubicacion?.lng ?? null, ruta_id: ruta_ids[0] ?? null, tipo_identificacion: rest.tipo_identificacion || null, identificacion: rest.identificacion || null, correo_fe: rest.correo_fe || null };

    let clienteId = editId;
    if (editId) {
      const { error } = await supabase.from("clientes").update(payload).eq("id", editId);
      if (error) {
        setBusy(false);
        return toast.error(error.message);
      }
    } else {
      const { data, error } = await supabase.from("clientes").insert(payload).select("id").single();
      if (error || !data) {
        setBusy(false);
        return toast.error(error?.message ?? "Error al guardar");
      }
      clienteId = data.id;
    }

    // Sincronizar rutas del cliente
    if (!clienteId) { setBusy(false); return; }
    await supabase.from("cliente_rutas").delete().eq("cliente_id", clienteId);
    if (ruta_ids.length) {
      const { error: relErr } = await supabase
        .from("cliente_rutas")
        .insert(ruta_ids.map((ruta_id) => ({ cliente_id: clienteId, ruta_id })));
      if (relErr) {
        setBusy(false);
        return toast.error(relErr.message);
      }
    }

    setBusy(false);
    toast.success(editId ? "Cliente actualizado" : "Cliente registrado");
    invalidate(["clientes"]);
    setOpen(false);
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={`${clientes?.length ?? 0} registrados`}
        action={
          <Button onClick={openNew} className="gap-1.5">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nuevo</span>
          </Button>
        }
      />
      <div className="space-y-4 p-4 md:p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar cliente…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c.id} className="px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <button onClick={() => openEdit(c)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-semibold leading-tight">{c.nombre}</p>
                  <p className="flex items-center gap-1 truncate text-[11px] leading-tight text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{c.distrito || c.direccion || "—"}</span>
                    {((c as any).cliente_rutas ?? []).map((cr: any) => (
                      <Badge key={cr.ruta_id} variant="secondary" className="h-4 shrink-0 px-1 text-[9px]">
                        {cr.rutas?.nombre}
                      </Badge>
                    ))}
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-1 [&_button]:h-7 [&_button]:w-7 [&_a]:h-7 [&_a]:w-7">
                  <button
                    onClick={() => setHistCliente({ id: c.id, nombre: c.nombre })}
                    className="grid h-7 w-7 place-items-center rounded-lg bg-muted text-foreground"
                    title="Historial de compras"
                  >
                    <History className="h-3.5 w-3.5" />
                  </button>
                  <TelegramCliente clienteId={c.id} nombre={c.nombre} iconOnly />
                  {c.latitud != null && c.longitud != null && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${c.latitud},${c.longitud}`}
                      target="_blank"
                      rel="noreferrer"
                      className="grid h-7 w-7 place-items-center rounded-lg bg-primary/15 text-primary"
                      title="Ver en mapa"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => setDelCliente({ id: c.id, nombre: c.nombre })}
                      className="grid h-7 w-7 place-items-center rounded-lg bg-destructive/15 text-destructive"
                      title="Eliminar cliente"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
        {filtered.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Sin clientes.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Nombre completo">
              <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </Field>
            <Field label="Teléfono">
              <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo de cédula">
                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.tipo_identificacion} onChange={(e) => setForm({ ...form, tipo_identificacion: e.target.value })}>
                  <option value="">Sin cédula</option>
                  <option value="01">Física</option>
                  <option value="02">Jurídica</option>
                  <option value="03">DIMEX</option>
                  <option value="04">NITE</option>
                </select>
              </Field>
              <Field label="Cédula">
                <Input value={form.identificacion} onChange={(e) => setForm({ ...form, identificacion: e.target.value.replace(/\D/g, "") })} />
              </Field>
            </div>
            <Field label="Correo para factura electrónica">
              <Input type="email" value={form.correo_fe} onChange={(e) => setForm({ ...form, correo_fe: e.target.value })} />
            </Field>
            <Field label="Dirección exacta">
              <Input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
            </Field>
            <DireccionCliente value={form} onChange={(direccion) => setForm((f) => ({ ...f, ...direccion }))} />
            <Field label="Referencia">
              <Input value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} />
            </Field>
            <Field label="Rutas (puede seleccionar varias)">
              <div className="flex flex-wrap gap-2">
                {rutas?.map((r) => {
                  const active = form.ruta_ids.includes(r.id);
                  return (
                    <Button
                      key={r.id}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          ruta_ids: active
                            ? f.ruta_ids.filter((id) => id !== r.id)
                            : [...f.ruta_ids, r.id],
                        }))
                      }
                    >
                      {r.nombre}
                    </Button>
                  );
                })}
                {!rutas?.length && (
                  <p className="text-xs text-muted-foreground">No hay rutas creadas.</p>
                )}
              </div>
            </Field>
            <ClienteUbicacion latitud={form.latitud} longitud={form.longitud} onChange={(latitud, longitud) => setForm((f) => ({ ...f, latitud, longitud }))} />
            <Button className="w-full" size="lg" disabled={busy} onClick={save}>
              {busy ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <HistorialCliente
        cliente={histCliente}
        open={!!histCliente}
        onClose={() => setHistCliente(null)}
      />

      <AlertDialog open={!!delCliente} onOpenChange={(o) => !o && setDelCliente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará a <strong>{delCliente?.nombre}</strong>. Esta acción no se
              puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarEliminar}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
