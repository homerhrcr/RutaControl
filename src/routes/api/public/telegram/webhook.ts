import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: { handlers: {
    GET: async () => Response.json({ service: "Ruta Directo Telegram", ok: true }),
    POST: async ({ request }) => {
      const { verificarWebhook, procesarUpdate } = await import("@/lib/telegram.server");
      if (!verificarWebhook(request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "")) return new Response("Unauthorized", { status: 401 });
      const raw = await request.text();
      if (raw.length > 100000) return new Response("Payload too large", { status: 413 });
      let input;
      try { input = JSON.parse(raw); } catch { return new Response("Invalid JSON", { status: 400 }); }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      try { return Response.json(await procesarUpdate(input, supabaseAdmin)); }
      catch (e) { console.error("Telegram recepción", e); return Response.json({ ok: false }, { status: 500 }); }
    },
  } },
});