import { useEffect, useRef, useState } from "react";
import { Download, Printer, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cerrarPdf, descargarBlob, suscribirPdf, type PdfPreviewState } from "@/lib/pdf-preview";

export function PdfPreviewHost() {
  const [st, setSt] = useState<PdfPreviewState | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => suscribirPdf(setSt), []);
  useEffect(() => {
    if (!st) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(st.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [st]);

  if (!st) return null;

  const imprimir = () => {
    try {
      frame.current?.contentWindow?.focus();
      frame.current?.contentWindow?.print();
    } catch {
      if (url) window.open(url, "_blank");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && cerrarPdf()}>
      <DialogContent className="flex h-[90vh] w-[95vw] max-w-5xl flex-col gap-3 p-4 [&>button.absolute]:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <DialogTitle className="truncate">{st.titulo ?? "Vista previa del documento"}</DialogTitle>
            <DialogDescription className="truncate">{st.filename}</DialogDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={imprimir}>
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
            <Button variant="outline" size="sm" onClick={() => descargarBlob(st.blob, st.filename)}>
              <Download className="mr-2 h-4 w-4" /> Descargar PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={cerrarPdf}>
              <X className="mr-2 h-4 w-4" /> Cerrar
            </Button>
          </div>
        </div>
        {url && <iframe ref={frame} src={url} title="Vista previa PDF" className="min-h-0 w-full flex-1 rounded-md border bg-muted" />}
      </DialogContent>
    </Dialog>
  );
}
