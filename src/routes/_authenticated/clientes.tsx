import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClientes, useRutas, useInvalidate } from "@/lib/data";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search, MapPin, Phone, Crosshair, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clientes")({
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
  ruta_id: "",
  latitud: null as number | null,
  longitud: null as number | null,
};

function ClientesPage() {
  const { data: clientes } = useClientes();
  const { data: rutas } = useRutas();
  const invalidate = useInvalidate();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);

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
      distrito: c.distrito ?? "",
      canton: c.canton ?? "",
      provincia: c.provincia ?? "",
      referencia: c.referencia ?? "",
      ruta_id: c.ruta_id ?? "",
      latitud: c.latitud,
      longitud: c.longitud,
    });
    setEditId(c.id);
    setOpen(true);
  }

  function capturar() {
    if (!navigator.geolocation) return toast.error("GPS no disponible");
    toast.loading("Obteniendo ubicación…", { id: "gps" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, latitud: pos.coords.latitude, longitud: pos.coords.longitude }));
        toast.success("Ubicación capturada", { id: "gps" });
      },
      () => toast.error("No se pudo obtener la ubicación", { id: "gps" }),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function save() {
    if (!form.nombre.trim()) return toast.error("El nombre es obligatorio");
    setBusy(true);
    const payload = { ...form, ruta_id: form.ruta_id || null };
    const { error } = editId
      ? await supabase.from("clientes").update(payload).eq("id", editId)
      : await supabase.from("clientes").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
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

        <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <button onClick={() => openEdit(c)} className="min-w-0 flex-1 text-left">
                  <p className="truncate font-semibold">{c.nombre}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" /> {c.distrito || c.direccion || "—"}
                  </p>
                  {(c as any).rutas?.nombre && (
                    <Badge variant="secondary" className="mt-1.5 text-[10px]">{(c as any).rutas.nombre}</Badge>
                  )}
                </button>
                <div className="flex shrink-0 flex-col gap-1">
                  {c.telefono && (
                    <a
                      href={`https://wa.me/506${c.telefono.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  )}
                  {c.latitud && c.longitud && (
                    <a
                      href={`https://maps.google.com/?q=${c.latitud},${c.longitud}`}
                      target="_blank"
                      rel="noreferrer"
                      className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary"
                    >
                      <MapPin className="h-4 w-4" />
                    </a>
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
            <Field label="Dirección exacta">
              <Input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Distrito">
                <Input value={form.distrito} onChange={(e) => setForm({ ...form, distrito: e.target.value })} />
              </Field>
              <Field label="Cantón">
                <Input value={form.canton} onChange={(e) => setForm({ ...form, canton: e.target.value })} />
              </Field>
            </div>
            <Field label="Provincia">
              <Input value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} />
            </Field>
            <Field label="Referencia">
              <Input value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} />
            </Field>
            <Field label="Ruta">
              <Select value={form.ruta_id} onValueChange={(v) => setForm({ ...form, ruta_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Asignar ruta" />
                </SelectTrigger>
                <SelectContent>
                  {rutas?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button variant="outline" className="w-full gap-2" onClick={capturar}>
              <Crosshair className="h-4 w-4" />
              {form.latitud ? "Ubicación capturada ✓" : "Capturar ubicación actual"}
            </Button>
            {form.latitud != null && form.longitud != null && (
              <div className="space-y-1.5">
                <div className="overflow-hidden rounded-xl border">
                  <iframe
                    title="Mapa de ubicación"
                    className="h-44 w-full"
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${form.longitud - 0.003}%2C${form.latitud - 0.003}%2C${form.longitud + 0.003}%2C${form.latitud + 0.003}&layer=mapnik&marker=${form.latitud}%2C${form.longitud}`}
                  />
                </div>
                <a
                  href={`https://maps.google.com/?q=${form.latitud},${form.longitud}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1 text-xs text-primary hover:underline"
                >
                  <MapPin className="h-3 w-3" /> Abrir en Google Maps
                </a>
              </div>
            )}
            <Button className="w-full" size="lg" disabled={busy} onClick={save}>
              {busy ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
