<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Multi-company: every business table has organization_id (default current_organization_id()) guarded by a RESTRICTIVE RLS policy; roles live in organization_members per company and platform_admins marks the superadmin — keeps company data isolated without touching each permissive policy.

- Offline: pending sales/payments live in an IndexedDB outbox (src/lib/offline.ts) with client-generated UUIDs; registrarVenta/registrarAbono skip ids that already exist — prevents duplicates on retry.
- Android: Capacitor loads the published domain (server.url) because TanStack Start emits no static index.html; the service worker provides offline.
- Offline photos: blobs live in the IndexedDB "archivos" store and an "evidencias" outbox op; the local copy is deleted only after both the storage upload and the evidencias row are confirmed — photos survive restarts and retries never duplicate.
- Sync conflicts: critical ops (abonos) that no longer fit server state are written to sync_conflicts and kept locally as CONFLICT instead of being clamped; admins resolve them in /sincronizacion.
- Server→device sync uses the cambios_desde(cursor) RPC with a per-company cursor in localStorage and invalidates only changed tables' queries — avoids re-downloading everything on reconnect.
- Returns use the registrar_devolucion(jsonb) RPC with a client UUID — stock, waste and credit reduction happen atomically and retries are no-ops.
- Return inspection AI uses authenticated server functions and server-only Responses helpers; evidence uses the existing photo outbox and inspection text is stored in return notes — recommendations never mutate inventory until the user confirms a return.
- Delivering a preventa order calls registrarVenta with the order id as sale id; inventory aggregates quantities by product while sale detail preserves individual lines — retries resume without duplicating stock deductions or skipping repeated products.
- Client location editing uses ClienteUbicacion with validated decimal coordinates and a lazy Google Maps picker; reuse the existing SDK script/callback to avoid loading Maps twice.
- Client administrative addresses use a bundled territorial catalog and shared cascade helpers, storing names in the existing columns — keeps dependent options available without network access and preserves the existing data format.
- Telegram uses a dedicated gateway-backed bot with a verified public webhook, hashed expiring one-use client links and company-scoped conversations; notifications use persisted document deduplication and never cause a saved sale to retry on delivery failure.
- Telegram ordering Mini App (/telegram/catalogo) authenticates by an HMAC of the chat id signed with the webhook secret and requires an active link; prices are read server-side and orders use a client UUID — the gateway hides the bot token so initData cannot be verified, and retries never duplicate.
- Reports are built as data-only `Reporte` objects (src/lib/reportes-gerenciales.ts) and rendered by one exporter (src/lib/reporte-export.ts) for screen, PDF (jsPDF, shown in the global PdfPreviewHost) and Excel; company letterhead and logo come from config_fiscal — one format definition keeps every report consistent across outputs.
- Truck inventory uses company-scoped loads and atomic authenticated PostgreSQL RPCs for warehouse transfers, onboard sales, annulment and closure; sales carry carga_id through the offline outbox and never deduct warehouse stock twice. Load/closure require connectivity; offline sales subtract pending quantities locally until confirmed.
- Pricing: company-scoped fixed-price lists are assigned directly to clients; the shared price resolver supplies sales, new order lines and Telegram with base-price fallback, while saved order/sale lines and offline operations retain their original prices to preserve agreements and retry consistency.
