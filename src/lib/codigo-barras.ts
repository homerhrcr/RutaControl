import { useEffect, useRef } from "react";

/** Normaliza un código leído (quita espacios y caracteres de control). */
export function normalizarCodigo(c: string): string {
  return (c ?? "").replace(/[\s\u0000-\u001f]/g, "").trim();
}

/** Busca el producto por código de barras y, si no hay, por código interno. */
export function buscarPorCodigo<T extends { codigo?: string | null; codigo_barras?: string | null }>(productos: T[], leido: string): T | undefined {
  const c = normalizarCodigo(leido).toLowerCase();
  if (!c) return undefined;
  return (
    productos.find((p) => normalizarCodigo(p.codigo_barras ?? "").toLowerCase() === c) ??
    productos.find((p) => normalizarCodigo(p.codigo ?? "").toLowerCase() === c)
  );
}

/**
 * Detecta lectores tipo pistola (Bluetooth/USB en modo teclado): ráfaga rápida de teclas terminada en Enter.
 * Ignora lo que el usuario escribe a mano en campos de texto (teclas lentas).
 */
export function useLectorPistola(activo: boolean, onCodigo: (codigo: string) => void) {
  const cb = useRef(onCodigo);
  cb.current = onCodigo;
  useEffect(() => {
    if (!activo) return;
    let buf = "";
    let ultimo = 0;
    let rapidas = 0;
    const onKey = (e: KeyboardEvent) => {
      const ahora = performance.now();
      const dt = ahora - ultimo;
      ultimo = ahora;
      if (dt > 60) { buf = ""; rapidas = 0; }
      if (e.key === "Enter") {
        const codigo = normalizarCodigo(buf);
        if (codigo.length >= 4 && rapidas >= 3) {
          e.preventDefault();
          e.stopPropagation();
          const t = e.target as HTMLInputElement | null;
          // Limpia lo que la pistola haya escrito dentro de un campo enfocado.
          if (t && "value" in t && typeof t.value === "string" && t.value.endsWith(codigo)) {
            const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(t), "value")?.set;
            setter?.call(t, t.value.slice(0, -codigo.length));
            t.dispatchEvent(new Event("input", { bubbles: true }));
          }
          cb.current(codigo);
        }
        buf = "";
        rapidas = 0;
        return;
      }
      if (e.key.length === 1) {
        buf += e.key;
        if (dt <= 60) rapidas++;
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [activo]);
}

/** Confirmación audible/táctil de lectura. */
export function avisoLectura(ok: boolean) {
  try {
    navigator.vibrate?.(ok ? 60 : [80, 60, 80]);
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    o.frequency.value = ok ? 1500 : 300;
    o.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + (ok ? 0.08 : 0.25));
    o.onended = () => ctx.close();
  } catch { /* sin audio */ }
}
