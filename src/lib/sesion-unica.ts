/**
 * Máximo 2 dispositivos activos por usuario (cualquier tipo); el tercero desplaza al más antiguo.
 * móvil por usuario. Entrar en otro equipo del mismo tipo desconecta al
 * anterior. Sin conexión nunca se cierra nada.
 */
import { supabase } from "@/integrations/supabase/client";

const CLAVE = "rd.device_token";

export type TipoDispositivo = "computadora" | "movil";

export function tipoDispositivo(): TipoDispositivo {
  if (typeof navigator === "undefined") return "computadora";
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? "movil" : "computadora";
}

function nuevoToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

function tokenLocal(): string | null {
  try { return localStorage.getItem(CLAVE); } catch { return null; }
}

/** Llamar justo después de un inicio de sesión exitoso. */
let enCurso: Promise<void> | null = null;

/** Reutiliza el token del dispositivo (no consume otro cupo) y evita reclamos simultáneos. */
export function reclamarSesion(): Promise<void> {
  if (enCurso) return enCurso;
  enCurso = (async () => {
    let token = tokenLocal();
    if (!token) {
      token = nuevoToken();
      try { localStorage.setItem(CLAVE, token); } catch { /* ignore */ }
    }
    await supabase.rpc("reclamar_sesion", {
      p_tipo: tipoDispositivo(),
      p_token: token,
      p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    });
  })().finally(() => { enCurso = null; });
  return enCurso;
}

/** Libera el cupo de este dispositivo al cerrar sesión. */
export async function liberarSesion(): Promise<void> {
  const token = tokenLocal();
  if (!token) return;
  try { await supabase.rpc("liberar_sesion", { p_token: token }); } catch { /* ignore */ }
}

/** true = vigente o no comprobable (sin red); false = desplazada por otro equipo. */
export async function sesionSigueVigente(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (enCurso) { try { await enCurso; } catch { /* ignore */ } return true; }
  const token = tokenLocal();
  if (!token) {
    try { await reclamarSesion(); } catch { /* ignore */ }
    return true;
  }
  try {
    const { data, error } = await supabase.rpc("sesion_vigente", { p_tipo: tipoDispositivo(), p_token: token });
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}

export function limpiarTokenLocal() {
  try { localStorage.removeItem(CLAVE); } catch { /* ignore */ }
}
