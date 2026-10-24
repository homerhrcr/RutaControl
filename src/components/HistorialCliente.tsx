import { useMemo, useState } from "react";
import {
  useVentasCliente,
  useAbonosCliente,
  useCreditosClienteDetalle,
  useInvalidate,
  eliminarVenta,
  eliminarAbono,
} from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { useEmpresa } from "@/lib/empresa";
import { formatCRC } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Banknote, CreditCard, HandCoins, AlertCircle, Copy, MessageCircle, Trash2, Pencil, Printer } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { editarPrecioLineaVenta } from "@/lib/precios.functions";
import { TelegramEnviar } from "@/components/TelegramCliente";
import { limitarCreditos } from "@/lib/cobranza-rutas";
import { EditarCreditoDialog } from "@/components/EditarCreditoDialog";

type Evento =
  | { tipo: "venta"; id: string; fecha: string; venta: any }
  | { tipo: "abono"; id: string; fecha: string; monto: number };

export function HistorialCliente({
  cliente,
  open,
  onClose,
  soloDeuda = false,
  creditoIds,
  rutaNombre,
}: {
  cliente: { id: string; nombre: string } | null;
  open: boolean;
  onClose: () => void;
  soloDeuda?: boolean;
  creditoIds?: string[];
  rutaNombre?: string;
}) {
  const { isAdmin } = useAuth();
  const { data: empresa } = useEmpresa();
  const invalidate = useInvalidate();
  const { data: ventas, isLoading: lv } = useVentasCliente(cliente?.id, 100);
  const { data: abonos, isLoading: la } = useAbonosCliente(cliente?.id, 100);
  const { data: todosPendientes } = useCreditosClienteDetalle(cliente?.id);
  const pendientes = limitarCreditos(todosPendientes ?? [], creditoIds);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [borrar, setBorrar] = useState<
    { tipo: "venta" | "abono"; id: string } | null
  >(null);
  const editarPrecio = useServerFn(editarPrecioLineaVenta);
  const [editLinea, setEditLinea] = useState<{ id: string; nombre: string; precio: number } | null>(null);
  const [nuevoPrecio, setNuevoPrecio] = useState("");
  const [motivoPrecio, setMotivoPrecio] = useState("");
  const [guardandoPrecio, setGuardandoPrecio] = useState(false);
  const [credEdit, setCredEdit] = useState<{ c: any; modo: "editar" | "borrar" } | null>(null);

  async function confirmarPrecio() {
    if (!editLinea) return;
    setGuardandoPrecio(true);
    try {
      await editarPrecio({
        data: { detalleId: editLinea.id, precioNuevo: Number(nuevoPrecio), motivo: motivoPrecio },
      });
      toast.success("Precio modificado y registrado en auditoría");
      setEditLinea(null);
      invalidate(["ventas-cliente", "creditos-cliente-detalle", "creditos-cliente", "creditos-pendientes"]);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo modificar el precio");
    } finally {
      setGuardandoPrecio(false);
    }
  }

  /** Línea de detalle con marca de precio modificado y edición solo para administradores. */
  const LineaDetalle = ({ d, bloqueada }: { d: any; bloqueada?: boolean }) => (
    <div className="flex items-start justify-between gap-2 text-sm">
      <span className="flex-1">
        <span className="font-medium">{Number(d.cantidad)}×</span> {d.nombre_producto}
        {d.precio_modificado && (
          <span
            className="ml-1 rounded bg-warning/20 px-1 text-[10px] font-semibold text-warning"
            title={`Precio original ${formatCRC(Number(d.precio_original))} · ${d.motivo_modificacion ?? ""}`}
          >
            Modificado
          </span>
        )}
      </span>
      <span>{formatCRC(Number(d.total_linea))}</span>
      {isAdmin && !bloqueada && (
        <button
          type="button"
          className="mt-0.5 text-muted-foreground hover:text-foreground"
          title="Modificar precio (solo administradores)"
          onClick={() => {
            setEditLinea({ id: d.id, nombre: d.nombre_producto, precio: Number(d.precio_unitario) });
            setNuevoPrecio(String(d.precio_unitario));
            setMotivoPrecio("");
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  async function confirmarBorrar() {
    if (!borrar) return;
    try {
      if (borrar.tipo === "venta") await eliminarVenta(borrar.id);
      else await eliminarAbono(borrar.id);
      toast.success(borrar.tipo === "venta" ? "Venta eliminada" : "Abono eliminado");
      invalidate([
        "ventas-cliente",
        "abonos-cliente",
        "creditos-cliente",
        "creditos-cliente-detalle",
        "creditos-pendientes",
        "clientes",
      ]);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al eliminar");
    } finally {
      setBorrar(null);
    }
  }

  const totalPendiente = (pendientes ?? []).reduce((s, c) => s + Number(c.saldo ?? 0), 0);
  const totalOriginal = (pendientes ?? []).reduce((s, c) => s + Number(c.monto ?? 0), 0);
  const abonosDe = (c: any) =>
    [...((c.abonos ?? []) as any[])].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const totalAbonado = (pendientes ?? []).reduce(
    (s, c: any) => s + abonosDe(c).reduce((x, a) => x + Number(a.monto ?? 0), 0),
    0,
  );
  const fmtF = (f?: string) =>
    f
      ? new Date(f).toLocaleDateString("es-CR", { day: "2-digit", month: "short", year: "numeric" })
      : "—";

  function lineasEstado(): string[] {
    const lineas: string[] = [];
    lineas.push("*Pendiente de pago*");
    if (rutaNombre) lineas.push(`Ruta: ${rutaNombre}`);
    for (const c of (pendientes ?? []) as any[]) {
      lineas.push("");
      lineas.push(`*Compra ${fmtF(c.ventas?.fecha ?? c.fecha)}* — Total ${formatCRC(Number(c.monto))}`);
      for (const d of c.ventas?.detalle_ventas ?? []) {
        lineas.push(`  • ${Number(d.cantidad)}× ${d.nombre_producto}: ${formatCRC(Number(d.total_linea))}`);
      }
      const ab = abonosDe(c);
      if (ab.length) {
        lineas.push("  Abonos:");
        for (const a of ab) lineas.push(`  − ${fmtF(a.fecha)}: ${formatCRC(Number(a.monto))}`);
      }
      lineas.push(`  Saldo: ${formatCRC(Number(c.saldo))}`);
    }
    lineas.push("");
    lineas.push(`Total compras: ${formatCRC(totalOriginal)}`);
    lineas.push(`Total abonos: −${formatCRC(totalAbonado)}`);
    lineas.push(`*Total pendiente: ${formatCRC(totalPendiente)}*`);
    return lineas;
  }

  function buildMensaje() {
    return [`Hola ${cliente?.nombre ?? ""}, este es tu estado de cuenta:`, "", ...lineasEstado()].join("\n");
  }

  function textoImprimir() {
    const hoy = new Date().toLocaleDateString("es-CR", { day: "2-digit", month: "short", year: "numeric" });
    return [
      empresa?.nombre ?? "Ruta Directo",
      empresa?.telefono ? `Tel. ${empresa.telefono}` : "",
      empresa?.cedula ? `Cédula: ${empresa.cedula}` : "",
      `Estado de cuenta — ${hoy}`,
      `Cliente: ${cliente?.nombre ?? ""}`,
      "--------------------------------",
      ...lineasEstado().map((l) => l.replace(/\*/g, "")),
      "--------------------------------",
      ...(empresa?.direccion ? [empresa.direccion] : []),
    ]
      .filter(Boolean)
      .join("\n");
  }

  function imprimir() {
    const win = window.open("", "_blank", "width=420,height=720");
    if (!win) return toast.error("No se abrió la impresión. Use Copiar para compartir el estado de cuenta.");
    win.document.write('<!doctype html><html><head><title>Estado de cuenta</title><style>@page{size:80mm auto;margin:4mm}body{width:72mm;margin:0;font:12px monospace;color:#000}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><pre></pre></body></html>');
    const pre = win.document.querySelector("pre");
    if (pre) pre.textContent = textoImprimir();
    win.document.close();
    win.focus();
    win.onafterprint = () => win.close();
    setTimeout(() => win.print(), 300);
  }

  async function copiarMensaje() {
    try {
      await navigator.clipboard.writeText(buildMensaje());
      toast.success("Estado de cuenta copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  }



  const eventos = useMemo<Evento[]>(() => {
    const all: Evento[] = [
      ...(ventas ?? []).map((v) => ({
        tipo: "venta" as const,
        id: v.id,
        fecha: v.fecha ?? "",
        venta: v,
      })),
      ...(abonos ?? []).map((a) => ({
        tipo: "abono" as const,
        id: a.id,
        fecha: a.fecha ?? "",
        monto: Number(a.monto ?? 0),
      })),
    ];
    return all
      .filter((e) => {
        const f = (e.fecha ?? "").slice(0, 10);
        if (desde && f < desde) return false;
        if (hasta && f > hasta) return false;
        return true;
      })
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }, [ventas, abonos, desde, hasta]);

  const totalVentas = eventos
    .filter((e) => e.tipo === "venta")
    .reduce((s, e: any) => s + Number(e.venta.total ?? 0), 0);
  const totalAbonos = eventos
    .filter((e) => e.tipo === "abono")
    .reduce((s, e: any) => s + Number(e.monto ?? 0), 0);

  const isLoading = lv || la;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[100dvh] max-w-lg flex-col gap-0 p-0 sm:h-[88vh]">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="text-base">{soloDeuda ? "Detalle de deuda" : "Historial del cliente"}</DialogTitle>
          <p className="truncate text-xs text-muted-foreground">{cliente?.nombre}</p>
          {rutaNombre && <p className="text-xs text-muted-foreground">{rutaNombre}</p>}
        </DialogHeader>

        {!soloDeuda && (<div className="grid grid-cols-2 gap-2 border-b p-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Desde</label>
            <Input type="date" className="h-9" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Hasta</label>
            <Input type="date" className="h-9" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </div>)}

        <div className="flex-1 overflow-y-auto p-3">
          {(pendientes ?? []).length > 0 && (
            <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-bold text-destructive">
                  <AlertCircle className="h-4 w-4" /> Pendiente de pago
                </span>
                <span className="font-black text-destructive">{formatCRC(totalPendiente)}</span>
              </div>
              <div className="space-y-2">
                {(pendientes ?? []).map((c: any) => (
                  <div key={c.id} className="rounded-lg bg-card p-2.5">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {c.ventas?.fecha
                          ? new Date(c.ventas.fecha).toLocaleDateString("es-CR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="font-semibold text-destructive">Saldo {formatCRC(Number(c.saldo))}</span>
                        {isAdmin && <>
                          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Editar crédito" onClick={() => setCredEdit({ c, modo: "editar" })}><Pencil className="h-3.5 w-3.5" /></Button>
                          {!c.venta_id && abonosDe(c).length === 0 && <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="Borrar crédito" onClick={() => setCredEdit({ c, modo: "borrar" })}><Trash2 className="h-3.5 w-3.5" /></Button>}
                        </>}
                      </span>
                    </div>
                    {!c.venta_id && <p className="mb-1 text-xs text-muted-foreground">Saldo histórico del {fmtF(c.fecha)}</p>}
                    <div className="space-y-1">
                      {(c.ventas?.detalle_ventas ?? []).map((d: any) => (
                        <LineaDetalle key={d.id} d={d} bloqueada={!!c.ventas?.carga_id} />
                      ))}
                    </div>
                    <div className="mt-1.5 border-t pt-1.5 text-xs">
                      <div className="flex justify-between font-semibold">
                        <span>Total compra</span>
                        <span>{formatCRC(Number(c.monto))}</span>
                      </div>
                      {abonosDe(c).map((a: any) => (
                        <div key={a.id} className="flex justify-between text-accent">
                          <span>Abono {fmtF(a.fecha)}</span>
                          <span>−{formatCRC(Number(a.monto))}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-bold text-destructive">
                        <span>Saldo</span>
                        <span>{formatCRC(Number(c.saldo))}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-0.5 rounded-lg bg-card p-2.5 text-sm">
                <div className="flex justify-between"><span>Total compras</span><span>{formatCRC(totalOriginal)}</span></div>
                <div className="flex justify-between text-accent"><span>Total abonos</span><span>−{formatCRC(totalAbonado)}</span></div>
                <div className="flex justify-between font-black text-destructive"><span>Saldo pendiente</span><span>{formatCRC(totalPendiente)}</span></div>
              </div>
              <div className="mt-3 flex gap-2">
                <TelegramEnviar clienteId={cliente?.id} texto={buildMensaje()} />
                <Button size="sm" variant="outline" className="gap-1.5" onClick={imprimir}>
                  <Printer className="h-4 w-4" /> Imprimir
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={copiarMensaje}>
                  <Copy className="h-4 w-4" /> Copiar
                </Button>
              </div>
            </div>
          )}

          {soloDeuda && (pendientes ?? []).length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">Sin deudas pendientes.</p>
          )}
          {!soloDeuda && (<>
          {isLoading && <p className="py-10 text-center text-sm text-muted-foreground">Cargando…</p>}
          {!isLoading && eventos.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">Sin movimientos en este periodo.</p>
          )}
          <div className="space-y-3">
            {eventos.map((e) => {
              const fechaTxt = new Date(e.fecha).toLocaleDateString("es-CR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              });
              if (e.tipo === "abono") {
                return (
                  <div key={`a-${e.id}`} className="rounded-xl border border-accent/40 bg-accent/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        <HandCoins className="h-4 w-4 text-accent" /> Abono · {fechaTxt}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-accent">{formatCRC(e.monto)}</span>
                        {isAdmin && (
                          <button
                            onClick={() => setBorrar({ tipo: "abono", id: e.id })}
                            className="grid h-7 w-7 place-items-center rounded-lg bg-destructive/15 text-destructive"
                            title="Eliminar abono"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              const v = e.venta;
              return (
                <div key={`v-${e.id}`} className="rounded-xl border bg-card p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{fechaTxt}</span>
                    <Badge variant={v.metodo_pago === "credito" ? "outline" : "secondary"} className="gap-1 text-[10px]">
                      {v.metodo_pago === "credito" ? (
                        <CreditCard className="h-3 w-3" />
                      ) : (
                        <Banknote className="h-3 w-3" />
                      )}
                      {v.metodo_pago}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {(v.detalle_ventas ?? []).map((d: any) => (
                      <LineaDetalle key={d.id} d={d} bloqueada={!!v.carga_id} />
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t pt-2">
                    <TelegramEnviar tipo="tiquete" documentoId={v.id} />
                    {Number(v.descuento) > 0 ? (
                      <span className="text-xs text-muted-foreground">Desc. {formatCRC(Number(v.descuento))}</span>
                    ) : (
                      <span />
                    )}
                    <div className="flex items-center gap-2">
                      <span className="font-black">{formatCRC(Number(v.total))}</span>
                      {isAdmin && (
                        <button
                          onClick={() => setBorrar({ tipo: "venta", id: e.id })}
                          className="grid h-7 w-7 place-items-center rounded-lg bg-destructive/15 text-destructive"
                          title="Eliminar venta"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
          </>)}
        </div>

        {!soloDeuda && (<div className="flex items-center justify-between gap-3 border-t bg-card p-3 text-sm">
          <span className="text-muted-foreground">
            Compras <span className="font-black text-foreground">{formatCRC(totalVentas)}</span>
          </span>
          <span className="text-muted-foreground">
            Abonos <span className="font-black text-accent">{formatCRC(totalAbonos)}</span>
          </span>
        </div>)}
      </DialogContent>

      <Dialog open={!!editLinea} onOpenChange={(o) => !o && setEditLinea(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Modificar precio (administrador)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              {editLinea?.nombre} · precio actual {formatCRC(editLinea?.precio ?? 0)}
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
              Se recalcula el total de la venta y el saldo del crédito pendiente; el cambio queda en auditoría. El precio del catálogo y de las listas no cambia.
            </p>
            <Button className="w-full" disabled={guardandoPrecio} onClick={confirmarPrecio}>
              Confirmar cambio
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!borrar} onOpenChange={(o) => !o && setBorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {borrar?.tipo === "venta" ? "¿Eliminar venta?" : "¿Eliminar abono?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {borrar?.tipo === "venta"
                ? "Se eliminará la venta y se restaurará el inventario. Esta acción no se puede deshacer."
                : "Se eliminará el abono y se restaurará el saldo del crédito. Esta acción no se puede deshacer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarBorrar}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <EditarCreditoDialog credito={credEdit?.c ?? null} modo={credEdit?.modo ?? "editar"} onClose={() => setCredEdit(null)}
        onDone={() => invalidate(["creditos-cliente", "creditos-cliente-detalle", "creditos-pendientes", "creditos-ruta", "saldos-map", "resumen-dia"])} />
    </Dialog>
  );
}

