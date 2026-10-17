import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Restablecer contraseña — Ruta Directo" },
      { name: "description", content: "Define una nueva contraseña para tu cuenta de Ruta Directo." },
      { property: "og:title", content: "Restablecer contraseña — Ruta Directo" },
      { property: "og:description", content: "Define una nueva contraseña para tu cuenta de Ruta Directo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase envía el enlace con type=recovery en el hash
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setReady(true);
      return;
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    const t = setTimeout(() => setInvalid((v) => !ready && !v ? true : v), 4000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return toast.error("Las contraseñas no coinciden");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Contraseña actualizada");
    navigate({ to: "/auth" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/10 to-background px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-4 text-center text-2xl font-black tracking-tight">Nueva contraseña</h1>
        <Card className="p-5">
          {!ready ? (
            <p className="text-center text-sm text-muted-foreground">
              {invalid
                ? "El enlace no es válido o ya venció. Solicita uno nuevo desde la pantalla de ingreso."
                : "Verificando enlace…"}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="np">Nueva contraseña</Label>
                <div className="relative">
                  <Input
                    id="np"
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label={show ? "Ocultar contraseña" : "Ver contraseña"}
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp">Confirmar contraseña</Label>
                <Input
                  id="cp"
                  type={show ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={busy}>
                {busy ? "Guardando…" : "Guardar contraseña"}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
