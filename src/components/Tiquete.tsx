import { useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCRC, formatDateTime } from "@/lib/format";
import { Printer, MessageCircle, X, Copy } from "lucide-react";
import type { CartItem } from "@/lib/data";
import { TelegramEnviar } from "@/components/TelegramCliente";
import { useEmpresa } from "@/lib/empresa";
import { useAuth } from "@/lib/auth";

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
    "--------------------------------",
    ...lineas,
    "--------------------------------",
    t.descuento > 0 ? `Descuento: -${formatCRC(t.descuento)}` : null,
    `*TOTAL: ${formatCRC(t.total)}*`,
    `Pago: ${t.metodo === "contado" ? "Contado" : "Crédito"}`,
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
      await navigator.clipboard.writeText(buildTexto(data));
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
            className="mx-auto max-w-[280px] rounded-md bg-white p-4 font-mono text-[12px] leading-tight text-black shadow"
          >
            <div className="c">
              <div className="b big">{EMPRESA.nombre}</div>
              <div>{EMPRESA.telefono}</div>
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
              <span>{data.metodo === "contado" ? "Contado" : "Crédito"}</span>
            </div>
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
          <TelegramEnviar tipo="tiquete" documentoId={data.venta_id} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
