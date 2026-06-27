import { type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useOfflineQueue } from "@/lib/offline";
import { OfflineStatus } from "@/components/OfflineStatus";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo-la-rivera.png.asset.json";
import {
  LayoutDashboard,
  Map as MapIcon,
  Truck,
  Users,
  Package,
  CreditCard,
  HandCoins,
  Wallet,
  BarChart3,
  Moon,
  Sun,
  LogOut,
  Milk,
  UserCog,
  ScrollText,
  Wifi,
  WifiOff,
} from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
  mobile?: boolean;
}

const NAV: NavItem[] = [
  { to: "/ruta", label: "Iniciar Ruta", icon: Truck, mobile: true },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clientes", label: "Clientes", icon: Users, mobile: true },
  { to: "/mapa-rutas", label: "Mapa Rutas", icon: MapIcon },
  { to: "/cobranza", label: "Crédito y Cobros", icon: HandCoins, mobile: true },
  { to: "/productos", label: "Productos", icon: Package },
  { to: "/gastos", label: "Gastos", icon: Wallet },
  { to: "/reportes", label: "Reportes", icon: BarChart3 },
  { to: "/usuarios", label: "Usuarios", icon: UserCog, adminOnly: true },
  { to: "/auditoria", label: "Auditoría", icon: ScrollText, adminOnly: true },

];

export function AppShell({ children }: { children: ReactNode }) {
  const { nombre, roles, isAdmin, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { online, count } = useOfflineQueue();

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  const roleLabel = roles[0] ? roles[0].charAt(0).toUpperCase() + roles[0].slice(1) : "Usuario";
  const navItems = NAV.filter((n) => !n.adminOnly || isAdmin);
  const mobileItems = navItems.filter((n) => n.mobile);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white">
            <img src={logo.url} alt="Lácteos La Rivera" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight">Lácteos La Rivera</p>
            <p className="truncate text-xs text-sidebar-foreground/60">Gestión Comercial</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {navItems.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 px-2">
            <p className="truncate text-sm font-semibold">{nombre || "Usuario"}</p>
            <p className="text-xs text-sidebar-foreground/60">{roleLabel}</p>
          </div>
          <div className="mb-2 px-2">
            <OfflineStatus />
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="flex-1 text-sidebar-foreground hover:bg-sidebar-accent" onClick={toggle}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" className="flex-1 text-sidebar-foreground hover:bg-sidebar-accent" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between gap-2 border-b bg-card px-4 py-3 md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-white">
              <img src={logo.url} alt="Lácteos La Rivera" className="h-full w-full object-contain" />
            </div>
            <span className="truncate text-sm font-bold">Lácteos La Rivera</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggle}>
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {(!online || count > 0) && (
          <div
            className={cn(
              "flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium",
              online ? "bg-warning/20 text-warning" : "bg-destructive/15 text-destructive",
            )}
          >
            {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {online
              ? `Sincronizando ${count} venta(s) pendiente(s)…`
              : `Sin conexión${count > 0 ? ` · ${count} venta(s) en cola` : " · trabajando offline"}`}
          </div>
        )}

        <main className="flex-1 pb-20 md:pb-0">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-card md:hidden">
          {mobileItems.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <item.icon className="h-6 w-6" />
                {item.label}
              </Link>
            );
          })}
          <Link
            to="/menu"
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
              pathname === "/menu" ? "text-primary" : "text-muted-foreground",
            )}
          >
            <LayoutDashboard className="h-6 w-6" />
            Más
          </Link>
        </nav>
      </div>
    </div>
  );
}
