import { useMemo, useState } from "react";
import { useProductos, registrarVenta, type CartItem, useVentasCliente, useCliente } from "@/lib/data";
import { queueVenta } from "@/lib/offline";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { formatCRC } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tiquete, type TiqueteData } from "@/components/Tiquete";
import { toast } from "sonner";
import { Plus, Minus, Search, Repeat, X, Banknote, CreditCard, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const FAVORITOS = ["Queso Semiduro", "Queso Ratón", "Leche Fresca", "Yogurt", "Natilla", "Cuajada"];

function isFavorite(nombre: string) {
  return FAVORITOS.some((f) => nombre.toLowerCase().includes(f.toLowerCase()));
}

export function QuickSale({
  cliente,
  open,
  onClose,
  onDone,
}: {
  cliente: { id: string; nombre: string; ruta_id: string | null } | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const { data: productos } = useProductos(true);
  const { data: ventasPrev } = useVentasCliente(cliente?.id, 1);
  const { data: clienteFull } = useCliente(cliente?.id);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [search, setSearch] = useState("");
  const [descuento, setDescuento] = useState(0);
  const [busy, setBusy] = useState(false);
  const [tiquete, setTiquete] = useState<TiqueteData | null>(null);

  const list = useMemo(() => {
    const arr = (productos ?? []).filter((p) =>
      p.nombre.toLowerCase().includes(search.toLowerCase()),
    );
    return arr.sort((a, b) => Number(isFavorite(b.nombre)) - Number(isFavorite(a.nombre)));
  }, [productos, search]);

  const items = Object.values(cart);
  const subtotal = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const total = Math.max(0, subtotal - descuento);

  function add(p: { id: string; nombre: string; precio: number }, delta: number) {
    setCart((prev) => {
      const cur = prev[p.id]?.cantidad ?? 0;
      const next = cur + delta;
      const copy = { ...prev };
      if (next <= 0) {
        delete copy[p.id];
      } else {
        copy[p.id] = { producto_id: p.id, nombre: p.nombre, precio: Number(p.precio), cantidad: next };
      }
      return copy;
    });
  }

  function repeatLast() {
    const last = ventasPrev?.[0];
    if (!last?.detalle_ventas?.length) {
      toast.info("Este cliente no tiene compras anteriores");
      return;
    }
    const next: Record<string, CartItem> = {};
    for (const d of last.detalle_ventas) {
      if (!d.producto_id) continue;
      next[d.producto_id] = {
        producto_id: d.producto_id,
        nombre: d.nombre_producto,
        precio: Number(d.precio_unitario),
        cantidad: Number(d.cantidad),
      };
    }
    setCart(next);
    toast.success("Último pedido cargado");
  }

  function reset() {
    setCart({});
    setDescuento(0);
    setSearch("");
  }

  async function finalizar(metodo: "contado" | "credito") {
    if (!cliente || !user) return;
    if (items.length === 0) return toast.error("Agrega al menos un producto");
    setBusy(true);
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000 }),
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {
      /* sin gps */
    }
    const ventaParams = {
      cliente_id: cliente.id,
      cliente_nombre: cliente.nombre,
      ruta_id: cliente.ruta_id,
      vendedor_id: user.id,
      items,
      descuento,
      metodo,
      fecha_limite:
        metodo === "credito"
          ? new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)
          : null,
      lat,
      lng,
    };

    if (!navigator.onLine) {
      queueVenta(ventaParams);
      toast.success(`Venta ${metodo} guardada offline · ${formatCRC(total)}`, {
        description: "Se sincronizará al recuperar conexión",
      });
      reset();
      onDone();
      onClose();
      setBusy(false);
      return;
    }

    try {
      const venta = await registrarVenta(ventaParams);
      toast.success(`Venta ${metodo} registrada · ${formatCRC(total)}`);
      setTiquete({
        venta_id: venta.id,
        fecha: venta.fecha ?? new Date().toISOString(),
        cliente_nombre: cliente.nombre,
        cliente_telefono: (clienteFull as any)?.telefono ?? null,
        vendedor:
          (user.user_metadata as any)?.full_name ||
          (user.user_metadata as any)?.name ||
          (user.email ? user.email.split("@")[0] : null),
        items,
        subtotal,
        descuento,
        total,
        metodo,
        fecha_limite: ventaParams.fecha_limite,
      });
      reset();
      onDone();
      onClose();
    } catch (e: any) {
      // network failure fallback → queue
      queueVenta(ventaParams);
      toast.warning(`Sin conexión · Venta guardada offline · ${formatCRC(total)}`);
      reset();
      onDone();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[100dvh] max-w-lg flex-col gap-0 p-0 sm:h-[92vh]">
        <DialogHeader className="flex-row items-center justify-between space-y-0 border-b px-4 py-3">
          <div className="min-w-0">
            <DialogTitle className="truncate text-base">Venta rápida</DialogTitle>
            <p className="truncate text-xs text-muted-foreground">{cliente?.nombre}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b p-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar producto…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="secondary" onClick={repeatLast} className="shrink-0 gap-1.5">
            <Repeat className="h-4 w-4" /> Repetir
          </Button>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-3">
          {list.map((p) => {
            const qty = cart[p.id]?.cantidad ?? 0;
            return (
              <div
                key={p.id}
                className={cn(
                  "flex flex-col rounded-xl border bg-card p-2.5 transition-colors",
                  qty > 0 && "border-primary ring-1 ring-primary",
                )}
              >
                <button
                  onClick={() => add(p, 1)}
                  className="flex flex-1 flex-col items-start text-left"
                >
                  {isFavorite(p.nombre) && <Star className="mb-1 h-3.5 w-3.5 fill-warning text-warning" />}
                  <span className="line-clamp-2 text-sm font-semibold leading-tight">{p.nombre}</span>
                  <span className="mt-1 text-sm font-bold text-primary">{formatCRC(p.precio)}</span>
                </button>
                {qty > 0 ? (
                  <div className="mt-2 flex items-center justify-between">
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => add(p, -1)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="text-base font-bold">{qty}</span>
                    <Button size="icon" className="h-8 w-8" onClick={() => add(p, 1)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="mt-2 gap-1" onClick={() => add(p, 1)}>
                    <Plus className="h-4 w-4" /> Agregar
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t bg-card p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <label className="text-sm text-muted-foreground">Descuento</label>
            <Input
              type="number"
              className="h-9 w-28 text-right"
              value={descuento || ""}
              onChange={(e) => setDescuento(Number(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{items.length} producto(s)</span>
            <span className="text-2xl font-black">{formatCRC(total)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" className="h-14 gap-2 text-base" disabled={busy} onClick={() => finalizar("contado")}>
              <Banknote className="h-5 w-5" /> Contado
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="h-14 gap-2 text-base"
              disabled={busy}
              onClick={() => finalizar("credito")}
            >
              <CreditCard className="h-5 w-5" /> Crédito
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <Tiquete data={tiquete} open={!!tiquete} onClose={() => setTiquete(null)} />
    </>
  );
}
