import { useState } from "react";
import { Building2, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Selector de empresa activa. La pertenencia se valida en el servidor. */
export function OrgSwitcher({ className }: { className?: string }) {
  const { organizaciones, organizacionActiva, esSuperadmin, cambiarOrganizacion } = useAuth();
  const [open, setOpen] = useState(false);
  const [cambiando, setCambiando] = useState<string | null>(null);
  const router = useRouter();

  if (!organizacionActiva) return null;
  const puedeCambiar = organizaciones.length > 1 || esSuperadmin;

  const seleccionar = async (id: string) => {
    if (id === organizacionActiva.id) return setOpen(false);
    setCambiando(id);
    try {
      await cambiarOrganizacion(id);
      setOpen(false);
      await router.invalidate();
      toast.success("Empresa cambiada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo cambiar de empresa");
    } finally {
      setCambiando(null);
    }
  };

  if (!puedeCambiar) {
    return (
      <div className={cn("flex items-center gap-2 px-2 py-1.5 text-sm", className)}>
        <Building2 className="h-4 w-4 shrink-0" />
        <span className="truncate">{organizacionActiva.nombre}</span>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className={cn("h-10 w-full justify-between gap-2 px-2", className)}>
          <span className="flex min-w-0 items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate text-sm">{organizacionActiva.nombre}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {esSuperadmin ? "Todas las empresas" : "Mis empresas"}
        </p>
        <div className="max-h-72 overflow-y-auto">
          {organizaciones.map((o) => (
            <button
              key={o.id}
              type="button"
              disabled={!!cambiando}
              onClick={() => void seleccionar(o.id)}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent disabled:opacity-60"
            >
              {cambiando === o.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className={cn("h-4 w-4", o.id === organizacionActiva.id ? "opacity-100" : "opacity-0")} />
              )}
              <span className="truncate">{o.nombre}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
