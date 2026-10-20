import { useState } from "react";
import { Copy, FileText, Printer, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TelegramEnviar } from "@/components/TelegramCliente";
import { useEmpresa } from "@/lib/empresa";
import { useAuth } from "@/lib/auth";
import { mostrarPdf, descargarBlob } from "@/lib/pdf-preview";
import { textoDevolucion, type DevolucionTiquete } from "@/lib/tiquete-devolucion";

export function TiqueteDevolucion({ data, onClose }: { data: DevolucionTiquete | null; onClose: () => void }) {
  const { data: empresa } = useEmpresa();
  const { organizacionActiva } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!data) return null;
  const texto = textoDevolucion(data, empresa?.nombre ?? organizacionActiva?.nombre ?? "Ruta Directo");
  const completo = [texto, empresa?.telefono ? `Tel. ${empresa.telefono}` : "", empresa?.cedula ? `Cédula: ${empresa.cedula}` : "", empresa?.direccion].filter(Boolean).join("\n");
  const filename = `devolucion-${data.id.slice(0, 8)}.pdf`;

  function imprimir() {
    const win = window.open("", "_blank", "width=420,height=720");
    if (!win) return toast.error("No se abrió la impresión. Use PDF para descargar el tiquete.");
    win.document.write('<!doctype html><html><head><title>Tiquete de devolución</title><style>@page{size:80mm auto;margin:4mm}body{width:72mm;margin:0;font:12px monospace}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><pre></pre></body></html>');
    const pre = win.document.querySelector("pre");
    if (pre) pre.textContent = completo;
    win.document.close();
    win.focus();
    win.onafterprint = () => win.close();
    setTimeout(() => win.print(), 300);
  }

  async function pdf(compartir: boolean) {
    setBusy(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: [80, 200] });
      doc.setFont("helvetica").setFontSize(9);
      let y = 7;
      if (empresa?.logo) {
        try {
          const props = doc.getImageProperties(empresa.logo);
          const h = Math.min(18, 34 * props.height / props.width);
          doc.addImage(empresa.logo, props.fileType, 23, y, h * props.width / props.height, h);
          y += h + 4;
        } catch { /* An invalid logo must not prevent the receipt. */ }
      }
      const lines: string[] = doc.splitTextToSize(completo.replace(/₡/g, "CRC "), 68);
      for (const line of lines) {
        if (y > 191) { doc.addPage([80, 200]); y = 7; }
        doc.text(line, 6, y);
        y += 4;
      }
      const blob = doc.output("blob");
      if (!compartir) { mostrarPdf(blob, filename, "Tiquete de devolución"); return; }
      const file = new File([blob], filename, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Tiquete de devolución" });
      } else {
        descargarBlob(blob, filename);
        toast.info("PDF descargado: ábralo en la aplicación de su impresora Bluetooth o adjúntelo al mensaje.");
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) toast.error("No se pudo generar o compartir el tiquete.");
    } finally { setBusy(false); }
  }

  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto">
      <DialogHeader><DialogTitle>Tiquete de devolución</DialogTitle><DialogDescription>Comprobante de recepción</DialogDescription></DialogHeader>
      <pre className="max-h-[50dvh] overflow-y-auto whitespace-pre-wrap break-words rounded-md border bg-muted p-3 font-mono text-xs">{completo}</pre>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={imprimir}><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
        <Button variant="outline" onClick={async () => {
          try { await navigator.clipboard.writeText(completo); toast.success("Tiquete copiado para pegar en WhatsApp o Telegram"); }
          catch { toast.error("No se pudo copiar el tiquete"); }
        }}><Copy className="mr-2 h-4 w-4" />Copiar</Button>
        <Button variant="outline" disabled={busy} onClick={() => pdf(false)}><FileText className="mr-2 h-4 w-4" />Ver PDF</Button>
        <Button variant="outline" disabled={busy} onClick={() => pdf(true)}><Share2 className="mr-2 h-4 w-4" />Compartir PDF</Button>
        {data.cliente_id && completo.length <= 4096 && <TelegramEnviar clienteId={data.cliente_id} tipo="mensaje" texto={completo} />}
      </div>
    </DialogContent>
  </Dialog>;
}