import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  CreditCard,
  Boxes,
  Map,
  BarChart3,
  Moon,
  Sun,
  LogOut,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/menu")({
  component: MenuPage,
});

const ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/productos", label: "Productos", icon: Package },
  { to: "/ventas", label: "Ventas", icon: ShoppingCart },
  { to: "/cobranza", label: "Cobros y Crédito", icon: CreditCard },
  { to: "/rutas", label: "Rutas", icon: Map },
  { to: "/reportes", label: "Reportes", icon: BarChart3 },
] as const;

function MenuPage() {
  const { nombre, roles, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  const roleLabel = roles[0]
    ? roles[0].charAt(0).toUpperCase() + roles[0].slice(1)
    : "Usuario";

  return (
    <div>
      <PageHeader title="Más opciones" subtitle="Menú y configuración" />
      <div className="space-y-4 p-4">
        <Card className="p-4">
          <p className="text-base font-bold">{nombre || "Usuario"}</p>
          <p className="text-sm text-muted-foreground">{roleLabel}</p>
        </Card>

        <Card className="divide-y overflow-hidden p-0">
          {ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted"
            >
              <item.icon className="h-5 w-5 text-primary" />
              <span className="flex-1 text-sm font-medium">{item.label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </Card>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={toggle}>
            {theme === "dark" ? (
              <>
                <Sun className="mr-2 h-4 w-4" /> Modo claro
              </>
            ) : (
              <>
                <Moon className="mr-2 h-4 w-4" /> Modo oscuro
              </>
            )}
          </Button>
          <Button variant="destructive" className="flex-1" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" /> Salir
          </Button>
        </div>
      </div>
    </div>
  );
}
