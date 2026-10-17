import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useClientes } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { configurarWebhookTelegram } from "@/lib/telegram.functions";
import { TelegramConversacion } from "@/components/TelegramCliente";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Radio } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/telegram")({
  head: () => ({ meta: [
    { title: "Telegram de clientes — Ruta Directo" }, { name: "description", content: "Vinculación de clientes, notificaciones y conversaciones de Telegram en Ruta Directo." },
    { property: "og:title", content: "Telegram de clientes — Ruta Directo" }, { property: "og:description", content: "Confirmaciones, tiquetes y mensajes de clientes por Telegram." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: TelegramPage,
});
function TelegramPage() {
  const { data: clientes } = useClientes();
  const { esSuperadmin, organizacionActiva } = useAuth();
  const [clienteId, setClienteId] = useState("");
  const [busy, setBusy] = useState(false);
  const configurar = useServerFn(configurarWebhookTelegram);
  return <div><PageHeader title="Telegram" subtitle={organizacionActiva?.nombre} action={esSuperadmin ? <Button disabled={busy} variant="outline" onClick={async () => {
    setBusy(true); try { const result = await configurar(); if (result.activo) toast.success("Recepción de Telegram activa"); } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo activar"); } finally { setBusy(false); }
  }}><Radio className="mr-2 h-4 w-4" />Activar recepción</Button> : undefined} />
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-6">
      <Select value={clienteId} onValueChange={setClienteId}><SelectTrigger aria-label="Cliente de Telegram"><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger><SelectContent>{clientes?.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent></Select>
      {clienteId && <TelegramConversacion key={`${organizacionActiva?.id}:${clienteId}`} clienteId={clienteId} />}
    </div>
  </div>;
}