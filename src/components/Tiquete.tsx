import { useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCRC, formatDateTime } from "@/lib/format";
import { Printer, MessageCircle, X, Copy } from "lucide-react";
import type { CartItem } from "@/lib/data";
import { TelegramEnviar } from "@/components/TelegramCliente";
import { useEmpresa } from "@/lib/empresa";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export interface TiqueteData {
  venta_id: string;
  cliente_id?: string;
  fecha: string;
  cliente_nombre: string;
  cliente_telefono?: string | null;
  vendedor?: string | null;
  items: CartItem[];
  subtotal: number;
  descuento: number;
  total: number;
  metodo: "contado" | "credito";
  fecha_limite?: string | null;
  pos?: import("@/lib/pos-calculos").DatosPOS & { vuelto: number; pendiente: boolean };
}

function consecutivo(id: string) {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function buildTexto(t: TiqueteData, nombre: string, telefono: string) {
  const lineas = t.items.map(
    (i) => `${i.cantidad} x ${i.nombre}  ${formatCRC(i.precio * i.cantidad)}`,
  );
  return [
    `*${nombre}*`,
    telefono ? `Tel: ${telefono}` : null,
    `Tiquete #${consecutivo(t.venta_id)}`,
    formatDateTime(t.fecha),
    `Cliente: ${t.cliente_nombre}`,
    t.pos?.receptor.identificacion ? `Identificación: ${t.pos.receptor.identificacion}` : null,
    "--------------------------------",
    ...lineas,
    "--------------------------------",
    t.descuento > 0 ? `Descuento: -${formatCRC(t.descuento)}` : null,
    `*TOTAL: ${formatCRC(t.total)}*`,
    `Pago: ${t.pos ? t.pos.medio.toUpperCase() : t.metodo === "contado" ? "Contado" : "Crédito"}`,
    t.pos?.medio === "efectivo" ? `Recibido: ${formatCRC(t.pos.recibido)} · Vuelto: ${formatCRC(t.pos.vuelto)}` : null,
    t.pos ? "Comprobante interno. No es factura electrónica autorizada por Hacienda." : null,
    t.pos?.pendiente ? "Pendiente de sincronización" : null,
    "",
    "¡Gracias por su compra!",
  ]
    .filter(Boolean)
    .join("\n");
}

export function Tiquete({
  data,
  open,
  onClose,
}: {
  data: TiqueteData | null;
  open: boolean;
  onClose: () => void;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const { data: empresa } = useEmpresa();
  const { organizacionActiva } = useAuth();
  const nombreEmpresa = empresa?.nombre ?? organizacionActiva?.nombre ?? "Su empresa";
  const telefonoEmpresa = empresa?.telefono ?? "";

  if (!data) return null;

  function imprimir() {
    const node = printRef.current;
    if (!node) return;
    const win = window.open("", "_blank", "width=380,height=640");
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>Tiquete</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  body { font-family: 'Courier New', monospace; font-size: 12px; color:#000; margin:0; padding:8px; width:80mm; }
  .c { text-align:center; }
  .b { font-weight:bold; }
  .row { display:flex; justify-content:space-between; gap:8px; }
  .sep { border-top:1px dashed #000; margin:6px 0; }
  .big { font-size:15px; }
</style></head><body>${node.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 250);
  }

  async function copiar() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(buildTexto(data, nombreEmpresa, telefonoEmpresa));
      toast.success("Tiquete copiado");
    } catch {
      alert("No se pudo copiar automáticamente.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm gap-0 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">Tiquete de venta</span>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto bg-muted/30 p-4">
          <div
            ref={printRef}
            className="mx-auto max-w-[280px] rounded-md bg-white p-4 font-mono text-[12px] leading-tight text-black shadow [&_.row]:flex [&_.row]:justify-between [&_.row]:gap-2 [&_.c]:text-center [&_.b]:font-bold [&_.big]:text-[15px] [&_.sep]:my-2 [&_.sep]:border-t [&_.sep]:border-dashed [&_.sep]:border-border [&_.row>span]:min-w-0 [&_.row>span]:break-words"
          >
            <div className="c">
              <div className="b big">{nombreEmpresa}</div>
              {telefonoEmpresa && <div>Tel: {telefonoEmpresa}</div>}
            </div>
            <div className="sep" />
            <div className="row">
              <span>Tiquete</span>
              <span className="b">#{consecutivo(data.venta_id)}</span>
            </div>
            <div className="row">
              <span>Fecha</span>
              <span>{formatDateTime(data.fecha)}</span>
            </div>
            <div className="row">
              <span>Cliente</span>
              <span className="b">{data.cliente_nombre}</span>
            </div>
            {data.vendedor && (
              <div className="row">
                <span>Vendedor</span>
                <span>{data.vendedor}</span>
              </div>
            )}
            {data.pos?.receptor.identificacion && <div className="row"><span>Identificación</span><span>{data.pos.receptor.identificacion}</span></div>}
            <div className="sep" />
            {data.items.map((i) => (
              <div key={i.producto_id} className="mb-1">
                <div className="b">{i.nombre}</div>
                <div className="row">
                  <span>
                    {i.cantidad} x {formatCRC(i.precio)}
                  </span>
                  <span>{formatCRC(i.precio * i.cantidad)}</span>
                </div>
              </div>
            ))}
            <div className="sep" />
            {data.descuento > 0 && (
              <div className="row">
                <span>Descuento</span>
                <span>-{formatCRC(data.descuento)}</span>
              </div>
            )}
            <div className="row big b">
              <span>TOTAL</span>
              <span>{formatCRC(data.total)}</span>
            </div>
            <div className="row">
              <span>Pago</span>
              <span>{data.pos ? data.pos.medio.toUpperCase() : data.metodo === "contado" ? "Contado" : "Crédito"}</span>
            </div>
            {data.pos?.medio === "efectivo" && <><div className="row"><span>Recibido</span><span>{formatCRC(data.pos.recibido)}</span></div><div className="row"><span>Vuelto</span><span>{formatCRC(data.pos.vuelto)}</span></div></>}
            {data.pos && <p className="mt-3 text-center text-[10px]">Comprobante interno. No es factura electrónica autorizada por Hacienda.{data.pos.pendiente ? " Pendiente de sincronización." : ""}</p>}
            <div className="sep" />
            <div className="c">¡Gracias por su compra!</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 border-t p-3">
          <Button variant="secondary" className="gap-2" onClick={imprimir}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
          <Button variant="outline" className="gap-2" onClick={copiar}>
            <Copy className="h-4 w-4" /> Copiar
          </Button>
          {!data.pos?.pendiente && data.cliente_id && <TelegramEnviar tipo="tiquete" documentoId={data.venta_id} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
