// Vista previa global de PDF: los reportes entregan su archivo aquí y se muestran en una ventana.
export type PdfPreviewState = { blob: Blob; filename: string; titulo?: string };

type Listener = (s: PdfPreviewState | null) => void;
const listeners = new Set<Listener>();
let actual: PdfPreviewState | null = null;

export function mostrarPdf(blob: Blob, filename: string, titulo?: string) {
  actual = { blob, filename, titulo };
  listeners.forEach((l) => l(actual));
}

export function cerrarPdf() {
  actual = null;
  listeners.forEach((l) => l(null));
}

export function suscribirPdf(l: Listener) {
  listeners.add(l);
  l(actual);
  return () => {
    listeners.delete(l);
  };
}

export function descargarBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
