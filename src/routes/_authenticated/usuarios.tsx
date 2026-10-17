import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import {
  listUsuarios,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  resetPasswordUsuario,
} from "@/lib/usuarios.functions";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, UserCog, Eye, EyeOff, KeyRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuarios — Ruta Directo" },
      { name: "description", content: "Administración de cuentas y roles de Ruta Directo." },
      { property: "og:title", content: "Usuarios — Ruta Directo" },
      { property: "og:description", content: "Administración de cuentas y roles de Ruta Directo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsuariosPage,
});

const ROLES = [
  { value: "administrador", label: "Administrador" },
  { value: "vendedor", label: "Vendedor" },
  { value: "cobrador", label: "Cobrador" },
] as const;

type Usuario = {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  roles: string[];
  created_at: string;
};

const emptyForm = {
  email: "",
  password: "",
  nombre: "",
  telefono: "",
  role: "vendedor" as (typeof ROLES)[number]["value"],
};

export function UsuariosPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const listFn = useServerFn(listUsuarios);
  const createFn = useServerFn(createUsuario);
  const updateFn = useServerFn(updateUsuario);
  const deleteFn = useServerFn(deleteUsuario);

  const resetFn = useServerFn(resetPasswordUsuario);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [detail, setDetail] = useState<Usuario | null>(null);
  const [passUser, setPassUser] = useState<Usuario | null>(null);
  const [newPass, setNewPass] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);

  const { data: usuarios, isLoading } = useQuery({
    queryKey: ["usuarios"],
    queryFn: () => listFn(),
    enabled: isAdmin,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (editId) {
        await updateFn({
          data: {
            id: editId,
            nombre: form.nombre,
            telefono: form.telefono,
            role: form.role,
          },
        });
      } else {
        await createFn({
          data: {
            email: form.email,
            password: form.password,
            nombre: form.nombre,
            telefono: form.telefono,
            role: form.role,
          },
        });
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Usuario actualizado" : "Usuario creado");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["usuarios"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Error al guardar"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Usuario eliminado");
      qc.invalidateQueries({ queryKey: ["usuarios"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Error al eliminar"),
  });

  const resetMut = useMutation({
    mutationFn: async () => {
      if (!passUser) return;
      await resetFn({ data: { id: passUser.id, password: newPass } });
    },
    onSuccess: () => {
      toast.success("Contraseña actualizada");
      setPassUser(null);
      setNewPass("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Error al cambiar la contraseña"),
  });

  function openNew() {
    setForm(emptyForm);
    setEditId(null);
    setOpen(true);
  }

  function openEdit(u: Usuario) {
    setForm({
      email: u.email,
      password: "",
      nombre: u.nombre,
      telefono: u.telefono,
      role: (u.roles[0] as (typeof ROLES)[number]["value"]) ?? "vendedor",
    });
    setEditId(u.id);
    setOpen(true);
  }

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Usuarios" subtitle="Gestión de usuarios" />
        <div className="p-4">
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Solo los administradores pueden gestionar usuarios.
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Usuarios" subtitle="Gestión, creación y roles" />
      <div className="space-y-4 p-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo usuario
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                saveMut.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  required
                />
              </div>
              {!editId && (
                <>
                  <div className="space-y-1.5">
                    <Label>Correo</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Contraseña</Label>
                    <Input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      minLength={6}
                      required
                    />
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Rol</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) =>
                    setForm({ ...form, role: v as (typeof ROLES)[number]["value"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={saveMut.isPending}>
                {saveMut.isPending ? "Guardando…" : "Guardar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <div className="space-y-2">
            {(usuarios ?? []).map((u) => (
              <Card key={u.id} className="flex items-center gap-3 p-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <UserCog className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{u.nombre || "Sin nombre"}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {u.roles.length ? (
                      u.roles.map((r) => (
                        <Badge key={r} variant="secondary" className="text-[10px] capitalize">
                          {r}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        sin rol
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setDetail(u)} aria-label="Ver usuario">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(u)} aria-label="Editar usuario">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setPassUser(u);
                      setNewPass("");
                      setShowNewPass(false);
                    }}
                    aria-label="Cambiar contraseña"
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar usuario</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se eliminará a {u.nombre || u.email} de forma permanente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMut.mutate(u.id)}>
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
