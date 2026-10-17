import { enviarTelegram } from "./telegram.functions";
import { toast } from "sonner";

/** Notifications must never turn a completed sale into an offline retry. */
export async function notificarDocumentoTelegram(tipo: "pedido" | "tiquete", documentoId: string) {
  try {
    const result = await enviarTelegram({ data: { tipo, documentoId } });
    if (result.status === "error" || result.status === "incierto") toast.warning("Documento guardado; revise el envío en Telegram");
  } catch (e) {
    console.error("Notificación Telegram pendiente de revisión", e);
    toast.warning("Documento guardado; no se pudo enviar la notificación por Telegram");
  }
}