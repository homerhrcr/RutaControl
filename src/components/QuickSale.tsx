import { useEffect, useMemo, useState } from "react";
import { registrarVenta, type CartItem, useVentasCliente, useCliente } from "@/lib/data";
import { useProductosCliente } from "@/lib/listas-precios";
import { aplicarPrecioManual } from "@/lib/precios";
import { queueVenta } from "@/lib/offline";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { formatCRC } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tiquete, type TiqueteData } from "@/components/Tiquete";
import { toast } from "sonner";
import { Plus, Minus, Search, Repeat, X, Banknote, CreditCard, Star, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCargasCamion, usePendientesCamion, descontarPendientes, disponibleCamion } from "@/lib/carga-camion";
import { validarVentaRuta } from "@/lib/carga-camion-calculos";

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
  const { user, isAdmin } = useAuth();
  const { data: cargas } = useCargasCamion();
  const { data: pendientes = [] } = usePendientesCamion();
  const disponibles = (cargas ?? []).filter((c) => c.estado === "en_ruta" && (c.vendedor_id === user?.id || isAdmin));
  // El inventario queda fijado al camión en ruta de la ruta del cliente: lo que no va a bordo no se puede entregar.
  const deRuta = disponibles.filter((c) => c.ruta_id === cliente?.ruta_id);
  const carga = deRuta.find((c) => c.vendedor_id === user?.id) ?? deRuta[0];
  const inventario = carga ? descontarPendientes(carga, pendientes) : [];
  const { data: productos, listo: preciosListos, listaNombre, error: preciosError } = useProductosCliente(cliente?.id, carga?.ruta_id ?? cliente?.ruta_id ?? null);
  const { data: ventasPrev } = useVentasCliente(cliente?.id, 1);
  const { data: clienteFull } = useCliente(cliente?.id);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [search, setSearch] = useState("");
  const [descuento, setDescuento] = useState(0);
  const [busy, setBusy] = useState(false);
  const [tiquete, setTiquete] = useState<TiqueteData | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [metodoSel, setMetodoSel] = useState<"contado" | "credito">("contado");
  const [editPrecio, setEditPrecio] = useState<CartItem | null>(null);
  const [nuevoPrecio, setNuevoPrecio] = useState("");
  const [motivoPrecio, setMotivoPrecio] = useState("");

  useEffect(() => {
    setCart({});
    setDescuento(0);
    setSearch("");
    setConfirmOpen(false);
    setMetodoSel("contado");
  }, [cliente?.id]);

  // Recalcula los precios del carrito si cambian cliente, ruta o condiciones; avisa si cambia el importe.
  useEffect(() => {
    if (!preciosListos || !productos) return;
    setCart((prev) => {
      let cambio = false;
      const next: Record<string, CartItem> = {};
      for (const [id, it] of Object.entries(prev)) {
        // Un precio modificado manualmente por un administrador no se recalcula.
        if (it.precioModificado) { next[id] = it; continue; }
        const p = productos.find((x) => x.id === id);
        if (!p || !p.precioInfo.valido) { cambio = true; continue; }
        if (Number(p.precio) !== it.precio) cambio = true;
        next[id] = { ...it, precio: Number(p.precio) };
      }
      if (cambio) toast.warning("Los precios se recalcularon según el cliente y la ruta; revise el total");
      return cambio ? next : prev;
    });
  }, [productos, preciosListos]);

  const list = useMemo(() => {
    const arr = (productos ?? []).filter((p) =>
      p.nombre.toLowerCase().includes(search.toLowerCase()),
    );
    return arr.sort((a, b) => Number(isFavorite(b.nombre)) - Number(isFavorite(a.nombre)));
  }, [productos, search]);

  const items = Object.values(cart);
  const subtotal = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const total = Math.max(0, subtotal - descuento);
  const ventaValida = validarVentaRuta(carga, cliente?.ruta_id, inventario, items);
  const sinCamion = "No hay camión en ruta cargado para esta ruta. Realice la carga del camión antes de vender";

  function add(p: { id: string; nombre: string; precio: number; precioInfo?: { valido: boolean; mensaje: string } }, delta: number) {
    if (!carga) return toast.error(sinCamion);
    if (!preciosListos) return toast.error("No se han cargado los precios del cliente");
    if (delta > 0 && p.precioInfo && !p.precioInfo.valido) return toast.error(`${p.nombre}: ${p.precioInfo.mensaje}`);
    if (carga && delta > 0 && (cart[p.id]?.cantidad ?? 0) + delta > disponibleCamion(inventario.find((d) => d.producto_id === p.id) ?? { producto_id: p.id, preventa: 0, extra: 0, vendido: 0, devuelto: 0, merma: 0 })) {
      toast.error("No hay más unidades disponibles en este camión");
      return;
    }
    setCart((prev) => {
      const cur = prev[p.id]?.cantidad ?? 0;
      const next = cur + delta;
      const copy = { ...prev };
      if (next <= 0) {
        delete copy[p.id];
      } else {
        copy[p.id] = { producto_id: p.id, nombre: p.nombre, precio: prev[p.id]?.precio ?? Number(p.precio), cantidad: next };
      }
      return copy;
    });
  }

  function repeatLast() {
    if (!carga) return toast.error(sinCamion);
    if (!preciosListos) return toast.error("No se han cargado los precios del cliente");
    const last = ventasPrev?.[0];
    if (!last?.detalle_ventas?.length) {
      toast.info("Este cliente no tiene compras anteriores");
      return;
    }
    const next: Record<string, CartItem> = {};
    for (const d of last.detalle_ventas) {
      const producto = productos?.find((p) => p.id === d.producto_id);
      if (!d.producto_id || !producto || !producto.precioInfo.valido) continue;
      next[d.producto_id] = {
        producto_id: d.producto_id,
        nombre: d.nombre_producto,
        precio: Number(producto.precio),
        cantidad: (next[d.producto_id]?.cantidad ?? 0) + Number(d.cantidad),
      };
    }
    if (!validarVentaRuta(carga, cliente?.ruta_id, inventario, Object.values(next))) {
      return toast.error("El último pedido supera las existencias disponibles del camión");
    }
    setCart(next);
    toast.success("Último pedido cargado");
  }

  function reset() {
    setCart({});
    setDescuento(0);
    setSearch("");
    setConfirmOpen(false);
    setMetodoSel("contado");
  }

  async function finalizar(metodo: "contado" | "credito") {
    if (!cliente || !user) return;
    if (!carga) return toast.error(sinCamion);
    if (!preciosListos) return toast.error("No se han cargado los precios del cliente");
    if (items.length === 0) return toast.error("Agrega al menos un producto");
    if (!ventaValida) return toast.error("La venta supera las existencias disponibles del camión de esta ruta");
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
      id: crypto.randomUUID(),
      ruta_id: carga.ruta_id,
      carga_id: carga.id,
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
      await queueVenta(ventaParams);
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
        cliente_id: cliente.id,
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
      if (navigator.onLine && !/fetch|network|conex|timeout/i.test(e?.message ?? "")) {
        toast.error(e?.message ?? "No se pudo registrar la venta");
        return;
      }
      // network failure fallback → queue
      await queueVenta(ventaParams);
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
            <p className="truncate text-xs text-primary">{listaNombre}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </DialogHeader>

        <div className="border-b px-3 py-2">
          <p className="mb-1 text-xs text-muted-foreground">Inventario de venta</p>
          {carga ? (
            <p className="rounded-md border bg-muted/40 px-2 py-2 text-sm font-medium">{`Camión · ${carga.rutas?.nombre} · ${carga.vehiculo || carga.fecha}`}</p>
          ) : (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-2 text-sm text-destructive">{sinCamion}</p>
          )}
        </div>

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
          <Button variant="secondary" disabled={!carga} onClick={repeatLast} className="shrink-0 gap-1.5">
            <Repeat className="h-4 w-4" /> Repetir
          </Button>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-3">
          {!preciosListos && <p className="col-span-full text-sm text-muted-foreground">{preciosError ? "No se pudieron cargar los precios del cliente." : "Cargando precios…"}</p>}
          {(carga ? list : []).map((p) => {
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
                  <span className="mt-1 text-sm font-bold text-primary">{p.precioInfo.valido ? formatCRC(p.precio) : "Sin precio"}</span>
                  <span className="text-[10px] leading-tight text-muted-foreground" title={p.precioInfo.mensaje}>{p.precioInfo.mensaje}</span>
                  {carga && <span className="text-xs text-muted-foreground">Disponible: {inventario.filter((d) => d.producto_id === p.id).reduce((s, d) => s + disponibleCamion(d), 0)}</span>}
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
          <Button
            size="lg"
            className="h-14 w-full gap-2 text-base"
            disabled={busy || !preciosListos || !ventaValida}
            onClick={() => setConfirmOpen(true)}
          >
            Confirmar venta · {formatCRC(total)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={confirmOpen} onOpenChange={(o) => !busy && setConfirmOpen(o)}>
      <DialogContent className="flex max-h-[90dvh] max-w-md flex-col gap-0 p-0">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="text-base">Confirmar venta</DialogTitle>
          <p className="truncate text-xs text-muted-foreground">{cliente?.nombre}</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {items.map((i) => (
              <div key={i.producto_id} className="flex items-start justify-between gap-2 text-sm">
                <span className="flex-1">
                  <span className="font-medium">{i.cantidad}×</span> {i.nombre}
                  {i.precioModificado && (
                    <span
                      className="ml-1 rounded bg-warning/20 px-1 text-[10px] font-semibold text-warning"
                      title={`Precio original ${formatCRC(i.precioOriginal ?? 0)} · ${i.motivoModificacion ?? ""}`}
                    >
                      Modificado
                    </span>
                  )}
                </span>
                <span className="font-semibold">{formatCRC(i.precio * i.cantidad)}</span>
                {isAdmin && !carga && (
                  <button
                    type="button"
                    className="mt-0.5 text-muted-foreground hover:text-foreground"
                    title="Modificar precio (solo administradores)"
                    onClick={() => {
                      setEditPrecio(i);
                      setNuevoPrecio(String(i.precio));
                      setMotivoPrecio("");
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1 border-t pt-3 text-sm">
            {descuento > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Descuento</span>
                <span>− {formatCRC(descuento)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-black">
              <span>Total</span>
              <span>{formatCRC(total)}</span>
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-sm text-muted-foreground">Método de pago</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={metodoSel === "contado" ? "default" : "outline"}
                className="h-12 gap-2"
                onClick={() => setMetodoSel("contado")}
              >
                <Banknote className="h-5 w-5" /> Contado
              </Button>
              <Button
                variant={metodoSel === "credito" ? "default" : "outline"}
                className="h-12 gap-2"
                onClick={() => setMetodoSel("credito")}
              >
                <CreditCard className="h-5 w-5" /> Crédito
              </Button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t p-3">
          <Button variant="ghost" className="h-12" disabled={busy} onClick={() => setConfirmOpen(false)}>
            Volver
          </Button>
          <Button
            size="lg"
            className="h-12 flex-1 gap-2 text-base"
            disabled={busy || !preciosListos || !ventaValida}
            onClick={() => finalizar(metodoSel)}
          >
            Enviar venta
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={!!editPrecio} onOpenChange={(o) => !o && setEditPrecio(null)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Modificar precio (administrador)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm">
            {editPrecio?.nombre} · precio actual {formatCRC(editPrecio?.precio ?? 0)}
          </p>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Precio unitario nuevo</label>
            <Input type="number" min={0} step="0.01" value={nuevoPrecio} onChange={(e) => setNuevoPrecio(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Motivo de la modificación</label>
            <Input value={motivoPrecio} onChange={(e) => setMotivoPrecio(e.target.value)} placeholder="Ej.: autorizado por gerencia" />
          </div>
          <p className="text-xs text-muted-foreground">
            El cambio aplica solo a esta venta y queda registrado en auditoría. El precio del catálogo y de las listas no cambia.
          </p>
          <Button
            className="w-full"
            onClick={() => {
              if (!editPrecio) return;
              try {
                const actualizado = aplicarPrecioManual(editPrecio, Number(nuevoPrecio), motivoPrecio, isAdmin);
                setCart((prev) => ({ ...prev, [actualizado.producto_id]: actualizado }));
                setEditPrecio(null);
                toast.success("Precio modificado solo para esta venta");
              } catch (e: any) {
                toast.error(e?.message ?? "No se pudo modificar el precio");
              }
            }}
          >
            Confirmar cambio
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Tiquete data={tiquete} open={!!tiquete} onClose={() => setTiquete(null)} />
    </>
  );
}
