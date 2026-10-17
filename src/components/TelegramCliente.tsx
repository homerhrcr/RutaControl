import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { crearVinculoTelegram, desvincularTelegram, enviarTelegram } from "@/lib/telegram.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Send, Copy, Link2, Unlink, Loader2, MessageCircle, CheckCircle2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

export function resultadoTelegram(status: string) {
  if (status === "enviado") toast.success("Enviado por Telegram");
  else if (status === "sin_vinculo") toast.info("El cliente debe vincular su Telegram primero");
  else if (status === "incierto") toast.warning("No se pudo confirmar el envío. Revise Telegram antes de repetirlo");
  else toast.error("No se pudo enviar. Revise que el cliente no haya bloqueado el bot");
}
export function TelegramEnviar({ clienteId, documentoId, tipo = "mensaje", texto, iconOnly = false }: {
  clienteId?: string; documentoId?: string; tipo?: "pedido" | "tiquete" | "mensaje"; texto?: string; iconOnly?: boolean;
}) {
  const enviar = useServerFn(enviarTelegram);
  const [busy, setBusy] = useState(false);
  const [envioId] = useState(() => crypto.randomUUID());
  return <Button title="Enviar por Telegram" aria-label="Enviar por Telegram" size={iconOnly ? "icon" : "sm"} className="gap-1.5" disabled={busy} onClick={async () => {
    if (!navigator.onLine) return toast.info("El envío por Telegram requiere conexión; la venta o pedido permanece guardado");
    setBusy(true);
    try { resultadoTelegram((await enviar({ data: { clienteId, documentoId, tipo, texto, envioId } })).status); }
    catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo enviar"); }
    finally { setBusy(false); }
  }}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{!iconOnly && "Telegram"}</Button>;
}

export function TelegramCliente({ clienteId, nombre, iconOnly = false }: { clienteId: string; nombre: string; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button variant="outline" size={iconOnly ? "icon" : "sm"} title="Telegram del cliente" aria-label={`Telegram de ${nombre}`} className="gap-1.5" onClick={() => setOpen(true)}>
      <Send className="h-4 w-4" />{!iconOnly && "Telegram"}
    </Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto"><DialogHeader><DialogTitle>Telegram · {nombre}</DialogTitle></DialogHeader>
      {open && <TelegramConversacion clienteId={clienteId} />}
    </DialogContent></Dialog>
  </>;
}

export function TelegramConversacion({ clienteId, nombre }: { clienteId: string; nombre?: string }) {
  const { organizacionActiva } = useAuth();
  const orgId = organizacionActiva?.id;
  const qc = useQueryClient();
  const crear = useServerFn(crearVinculoTelegram);
  const quitar = useServerFn(desvincularTelegram);
  const enviar = useServerFn(enviarTelegram);
  const [url, setUrl] = useState("");
  const [texto, setTexto] = useState("");
  const [busy, setBusy] = useState(false);
  const [envioId, setEnvioId] = useState(() => crypto.randomUUID());
  const { data, error, isPending } = useQuery({
    queryKey: ["telegram-cliente", orgId, clienteId], enabled: !!orgId,
    refetchInterval: url ? 3000 : 10000,
    queryFn: async () => {
      const [vinculo, mensajes] = await Promise.all([
        supabase.from("telegram_clientes").select("activo,telegram_nombre,vinculado_en").eq("cliente_id", clienteId).eq("organization_id", orgId ?? "").maybeSingle(),
        supabase.from("telegram_mensajes").select("id,texto,direccion,estado,created_at").eq("cliente_id", clienteId).eq("organization_id", orgId ?? "").order("created_at", { ascending: false }).limit(100),
      ]);
      if (vinculo.error) throw vinculo.error;
      if (mensajes.error) throw mensajes.error;
      return { vinculo: vinculo.data, mensajes: (mensajes.data ?? []).reverse() };
    },
  });
  async function refresh() { await qc.invalidateQueries({ queryKey: ["telegram-cliente", orgId, clienteId] }); }
  async function accion(fn: () => Promise<void>) {
    if (!navigator.onLine) return toast.info("Telegram requiere conexión");
    setBusy(true);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo completar"); }
    finally { setBusy(false); }
  }
  if (isPending) return <p className="text-sm text-muted-foreground">Cargando Telegram…</p>;
  if (error) return <p className="text-sm text-destructive">No se pudo cargar Telegram.</p>;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
      <span className="text-sm font-semibold">{data?.vinculo?.activo ? `Vinculado · ${data.vinculo.telegram_nombre ?? "Cliente"}` : "Sin vincular"}</span>
      {data?.vinculo?.activo ? <Button variant="outline" size="sm" disabled={busy} onClick={() => accion(async () => { await quitar({ data: { clienteId } }); setUrl(""); await refresh(); })}><Unlink className="mr-1 h-4 w-4" />Desvincular</Button>
        : <Button size="sm" disabled={busy} onClick={() => accion(async () => setUrl((await crear({ data: { clienteId } })).url))}><Link2 className="mr-1 h-4 w-4" />Generar enlace</Button>}
    </div>
    {url && !data?.vinculo?.activo && <div className="space-y-3 text-center">
      <p className="text-sm font-medium">Que el cliente escanee este código con la cámara del celular y toque «Iniciar»</p>
      <div className="mx-auto w-fit rounded-lg bg-card p-3 ring-1 ring-border"><QRCodeSVG value={url} size={220} bgColor="#ffffff" fgColor="#000000" includeMargin /></div>
      <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Esperando que el cliente toque «Iniciar»…</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button asChild variant="outline"><a href={`https://wa.me/?text=${encodeURIComponent(`Hola ${nombre ?? ""}, toca este enlace para recibir tus comprobantes y hacer pedidos con nosotros por Telegram: ${url}`)}`} target="_blank" rel="noreferrer"><MessageCircle className="mr-1 h-4 w-4" />Invitar por WhatsApp</a></Button>
        <Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(url); toast.success("Enlace copiado"); } catch { toast.error("No se pudo copiar"); } }}><Copy className="mr-1 h-4 w-4" />Copiar enlace</Button>
      </div>
      <p className="text-xs text-muted-foreground">El enlace vence en 24 horas.</p>
    </div>}
    {data?.vinculo?.activo && justLinked && <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm font-medium"><CheckCircle2 className="h-5 w-5 text-primary" />¡Vinculado con éxito! El cliente ya recibe comprobantes y puede hacer pedidos.</div>}
    <div className="max-h-80 space-y-3 overflow-y-auto" aria-label="Conversación Telegram">
      {!data?.mensajes.length && <p className="py-4 text-center text-sm text-muted-foreground">Sin mensajes.</p>}
      {data?.mensajes.map((m) => <div key={m.id} className={`max-w-[92%] rounded-md border p-3 ${m.direccion === "salida" ? "ml-auto bg-primary/10" : "bg-muted"}`}>
        <p className="whitespace-pre-wrap break-words text-sm">{m.texto}</p>
        <p className="mt-1 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("es-CR")} · {m.estado}</p>
      </div>)}
    </div>
    <div className="space-y-2 border-t pt-3"><Textarea aria-label="Mensaje para el cliente" placeholder="Mensaje…" maxLength={4096} value={texto} onChange={(e) => setTexto(e.target.value)} disabled={!data?.vinculo?.activo} />
      <Button className="w-full gap-2" disabled={busy || !texto.trim() || !data?.vinculo?.activo} onClick={() => accion(async () => {
        const result = await enviar({ data: { clienteId, tipo: "mensaje", texto, envioId } }); resultadoTelegram(result.status);
        if (result.status === "enviado") { setTexto(""); setEnvioId(crypto.randomUUID()); }
        await refresh();
      })}><Send className="h-4 w-4" />Enviar mensaje</Button>
    </div>
  </div>;
}