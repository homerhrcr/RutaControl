/**
 * Sesión única por tipo de equipo: máximo una sesión en computadora y una en
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
export async function reclamarSesion(): Promise<void> {
  const token = nuevoToken();
  try { localStorage.setItem(CLAVE, token); } catch { /* ignore */ }
  await supabase.rpc("reclamar_sesion", {
    p_tipo: tipoDispositivo(),
    p_token: token,
    p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
  });
}

/** true = vigente o no comprobable (sin red); false = desplazada por otro equipo. */
export async function sesionSigueVigente(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
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
