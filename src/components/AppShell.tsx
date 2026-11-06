import { type ReactNode, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useOfflineQueue } from "@/lib/offline";
import { useIncrementalPull } from "@/lib/sync-pull";
import { OfflineStatus } from "@/components/OfflineStatus";
import { OrgSwitcher } from "@/components/OrgSwitcher";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import truckImg from "@/assets/sidebar-truck.jpg";
import logo from "@/assets/logo-ruta-directo-2026.jpg.asset.json";
import {
  LayoutDashboard,
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
  Wifi,
  WifiOff,
  RefreshCw,
  ClipboardList,
  Undo2,
  Send,
  Store,
  Map as MapIcon,
  ClipboardCheck,
  ChevronDown,
  Settings,
  Menu,
} from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
  mobile?: boolean;
  group?: string;
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: true, mobile: true },
  { to: "/ruta", label: "Iniciar ruta", icon: Truck, mobile: true, group: "Rutas" },
  { to: "/carga-camion", label: "Carga de camión", icon: Truck, group: "Rutas" },
  { to: "/mapa-rutas", label: "Mapa de Rutas", icon: MapIcon, group: "Rutas" },
  { to: "/pedidos", label: "Preventa", icon: ClipboardList, mobile: true, group: "Rutas" },
  { to: "/devoluciones", label: "Devoluciones", icon: Undo2, group: "Rutas" },
  { to: "/liquidacion-ruta", label: "Liquidación de ruta", icon: ClipboardCheck, group: "Rutas" },
  { to: "/gastos", label: "Gastos", icon: Wallet },
  { to: "/cobranza", label: "Crédito y Cobros", icon: HandCoins, mobile: true },
  { to: "/clientes", label: "Clientes", icon: Users, mobile: true },
  { to: "/productos", label: "Productos", icon: Package },
  { to: "/pos", label: "Punto de Venta", icon: Store },
  { to: "/reportes", label: "Reportes", icon: BarChart3 },
  { to: "/ganadera", label: "Operaciones / Planta", icon: Wallet, adminOnly: true },
  { to: "/administracion", label: "Configuración", icon: UserCog, adminOnly: true, group: "Administración" },
  { to: "/sincronizacion", label: "Sincronización", icon: RefreshCw, group: "Administración" },
  { to: "/telegram", label: "Telegram", icon: Send, group: "Administración" },
];

const GROUPS: Record<string, { icon: typeof LayoutDashboard }> = {
  Rutas: { icon: Truck },
  Administración: { icon: Settings },
};

export function AppShell({ children }: { children: ReactNode }) {
  const { nombre, roles, isAdmin, esSuperadmin, organizacionActiva, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { online, count } = useOfflineQueue();
  useIncrementalPull();
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
  const [menuMovil, setMenuMovil] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  const roleLabel = esSuperadmin ? "Superadmin" : roles[0] ? roles[0].charAt(0).toUpperCase() + roles[0].slice(1) : "Usuario";
  const navItems = NAV.filter((n) => !n.adminOnly || isAdmin);
  const mobileItems = navItems.filter((n) => n.mobile);

  const panel = (movil: boolean) => (
      <aside
        onClick={movil ? (e) => { if ((e.target as HTMLElement).closest("a")) setMenuMovil(false); } : undefined}
        className={cn(
          "shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground",
          movil ? "flex h-full w-full" : "sticky top-0 hidden h-screen w-60 md:flex",
        )}
      >
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl">
            <img src={logo.url} alt="Ruta Directo" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight">Ruta Directo</p>
            <p className="truncate text-xs text-sidebar-foreground/60">Gestión Comercial</p>
          </div>
        </div>
        <div className="px-3 pb-2">
          <OrgSwitcher className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {navItems.map((item, i) => {
            const link = (sub: boolean) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  sub && "pl-8 py-2",
                  pathname === item.to
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                {item.label}
              </Link>
            );
            if (!item.group) return link(false);
            if (navItems[i - 1]?.group === item.group) return null;
            const grupo = GROUPS[item.group];
            const hijos = navItems.filter((n) => n.group === item.group);
            const dentro = hijos.some((n) => n.to === pathname);
            const abierto = abiertos[item.group] ?? dentro;
            const g = item.group;
            return (
              <div key={g}>
                <button
                  type="button"
                  onClick={() => setAbiertos((s) => ({ ...s, [g]: !abierto }))}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-sidebar-accent/60",
                    dentro ? "text-sidebar-foreground" : "text-sidebar-foreground/75",
                  )}
                >
                  <grupo.icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="flex-1 text-left">{g}</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", abierto && "rotate-180")} />
                </button>
                {abierto && (
                  <div className="mt-1 space-y-1">
                    {hijos.map((h) => {
                      const Item = h;
                      return (
                        <Link
                          key={Item.to}
                          to={Item.to}
                          className={cn(
                            "flex items-center gap-3 rounded-lg py-2 pl-8 pr-3 text-sm font-medium transition-colors",
                            pathname === Item.to
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                          )}
                        >
                          <Item.icon className="h-4 w-4 shrink-0" />
                          {Item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="mx-3 mb-3 shrink-0 overflow-hidden rounded-xl border [@media(max-height:760px)]:hidden border-sidebar-border shadow-[var(--glow)]">
          <div className="relative">
            <img src={truckImg} alt="Camión en ruta" loading="lazy" width={992} height={672} className="h-28 w-full object-cover" />
          </div>
        </div>
        <div className="shrink-0 border-t border-sidebar-border p-3">
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
  );

  return (
    <div className="flex min-h-screen bg-background">
      {panel(false)}
      <Sheet open={menuMovil} onOpenChange={setMenuMovil}>
        <SheetContent side="left" className="w-72 max-w-[85vw] border-sidebar-border bg-sidebar p-0 [&>button]:text-sidebar-foreground">
          <SheetTitle className="sr-only">Menú principal</SheetTitle>
          {panel(true)}
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between gap-2 border-b bg-card px-4 py-3 md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon" className="shrink-0" aria-label="Abrir menú" onClick={() => setMenuMovil(true)}>
              <Menu className="h-6 w-6" />
            </Button>
            <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-white">
              <img src={logo.url} alt="Ruta Directo" className="h-full w-full object-cover" />
            </div>
            <span className="truncate text-sm font-bold">Ruta Directo</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <OfflineStatus />
            <Button variant="ghost" size="icon" onClick={toggle}>
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>
        <div className="border-b bg-card px-2 py-1 md:hidden">
          <OrgSwitcher />
        </div>

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

        <main key={organizacionActiva?.id ?? "sin-empresa"} className="flex-1 pb-20 md:pb-0">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-card md:hidden">
          {mobileItems.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-1 px-0.5 py-2 text-center text-[11px] font-medium leading-tight transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <item.icon className="h-6 w-6" />
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMenuMovil(true)}
            className="flex min-w-0 flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium leading-tight text-muted-foreground transition-colors"
          >
            <Menu className="h-6 w-6" />
            Menú
          </button>
        </nav>
      </div>
    </div>
  );
}
