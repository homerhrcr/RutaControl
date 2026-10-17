import { useEffect, useRef, useState } from "react";
import { Download, Printer, X, ZoomIn, ZoomOut, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cerrarPdf, descargarBlob, suscribirPdf, type PdfPreviewState } from "@/lib/pdf-preview";

// Dibuja el PDF en <canvas> con PDF.js: los WebView de Android (tablet/APK) no muestran PDF dentro de un iframe.
export function PdfPreviewHost() {
  const [st, setSt] = useState<PdfPreviewState | null>(null);
  const [zoom, setZoom] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cont = useRef<HTMLDivElement>(null);

  useEffect(() => suscribirPdf(setSt), []);

  useEffect(() => {
    if (!st) return;
    let cancelado = false;
    let doc: { destroy: () => Promise<void> } | null = null;
    (async () => {
      setCargando(true);
      setError(null);
      try {
        const pdfjs = await import("pdfjs-dist");
        const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = worker;
        const data = new Uint8Array(await st.blob.arrayBuffer());
        const pdf = await pdfjs.getDocument({ data }).promise;
        doc = pdf;
        const el = cont.current;
        if (!el || cancelado) return;
        el.innerHTML = "";
        const ancho = Math.max(300, el.clientWidth - 16);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelado) return;
          const page = await pdf.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const escala = (ancho / base.width) * zoom;
          const vp = page.getViewport({ scale: escala * dpr });
          const canvas = document.createElement("canvas");
          canvas.width = vp.width;
          canvas.height = vp.height;
          canvas.style.width = `${vp.width / dpr}px`;
          canvas.style.height = `${vp.height / dpr}px`;
          canvas.className = "mx-auto mb-3 block bg-white shadow-md";
          el.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
        }
      } catch (e) {
        if (!cancelado) setError(e instanceof Error ? e.message : "No se pudo mostrar el PDF");
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => {
      cancelado = true;
      void doc?.destroy();
    };
  }, [st, zoom]);

  useEffect(() => {
    if (!st) setZoom(1);
  }, [st]);

  if (!st) return null;

  const imprimir = () => {
    const url = URL.createObjectURL(st.blob);
    const w = window.open(url, "_blank");
    if (!w) descargarBlob(st.blob, st.filename);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
            <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} aria-label="Alejar">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} aria-label="Acercar">
              <ZoomIn className="h-4 w-4" />
            </Button>
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
        <div className="relative min-h-0 flex-1 overflow-auto rounded-md border bg-muted p-2">
          {cargando && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando vista previa…
            </div>
          )}
          {error && <p className="p-4 text-sm text-destructive">{error}. Use «Descargar PDF».</p>}
          <div ref={cont} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
