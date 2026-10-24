import { useEffect, useId, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScanBarcode } from "lucide-react";

/** Lector de códigos de barras con la cámara trasera. Sigue abierto para leer varios productos seguidos. */
export function EscanerCamara({ open, onClose, onCodigo, continuo = true }: { open: boolean; onClose: () => void; onCodigo: (c: string) => void; continuo?: boolean }) {
  const id = "escaner-" + useId().replace(/:/g, "");
  const [error, setError] = useState<string | null>(null);
  const cb = useRef(onCodigo);
  cb.current = onCodigo;

  useEffect(() => {
    if (!open) return;
    let scanner: any;
    let parado = false;
    let ultimo = { c: "", t: 0 };
    setError(null);
    const t = setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (parado) return;
        scanner = new Html5Qrcode(id);
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 140 } },
          (texto: string) => {
            const ahora = Date.now();
            if (texto === ultimo.c && ahora - ultimo.t < 1500) return; // evita lecturas dobles
            ultimo = { c: texto, t: ahora };
            cb.current(texto);
            if (!continuo) onClose();
          },
          () => {},
        );
      } catch (e: any) {
        setError("No se pudo abrir la cámara. Revise el permiso de cámara del navegador.");
      }
    }, 100);
    return () => {
      parado = true;
      clearTimeout(t);
      if (scanner) scanner.stop().then(() => scanner.clear()).catch(() => {});
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><ScanBarcode className="h-5 w-5" /> Leer código de barras</DialogTitle></DialogHeader>
        <div id={id} className="w-full overflow-hidden rounded-lg bg-muted" style={{ minHeight: 240 }} />
        {error ? <p className="text-sm text-destructive">{error}</p> : <p className="text-xs text-muted-foreground">Apunte la cámara al código. {continuo ? "Cada lectura suma una unidad." : ""}</p>}
        <Button variant="secondary" onClick={onClose}>Listo</Button>
      </DialogContent>
    </Dialog>
  );
}
