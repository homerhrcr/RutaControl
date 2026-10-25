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
- Subdirectories have their own AGENTS.md; read it before changing files there.
- POS uses atomic company-scoped RPCs to avoid duplicate cash sales.
- Multi-company: every business table has organization_id (default current_organization_id()) guarded by a RESTRICTIVE RLS policy; roles live in organization_members per company and platform_admins marks the superadmin — keeps company data isolated without touching each permissive policy.
- Offline: pending sales/payments live in an IndexedDB outbox (src/lib/offline.ts) with client-generated UUIDs; registrarVenta/registrarAbono skip ids that already exist — prevents duplicates on retry.
- Android: Capacitor loads the published domain (server.url) because TanStack Start emits no static index.html; the service worker provides offline.
- Sync conflicts: critical ops (abonos) that no longer fit server state are written to sync_conflicts and kept locally as CONFLICT instead of being clamped; admins resolve them in /sincronizacion.
- Server→device sync uses the cambios_desde(cursor) RPC with a per-company cursor in localStorage and invalidates only changed tables' queries — avoids re-downloading everything on reconnect.
- Returns use the registrar_devolucion(jsonb) RPC with a client UUID — stock, waste and credit reduction happen atomically and retries are no-ops.
- Delivering a preventa order calls registrarVenta with the order id as sale id; inventory aggregates quantities by product while sale detail preserves individual lines — retries resume without duplicating stock deductions or skipping repeated products.
- EntregarPedido retains Tiquete copy/print until onClose. History groups delivered orders via shared helpers by sale date in Costa Rica (legacy: scheduled date), excluding them from pending without deleting records.
- Telegram uses a dedicated gateway-backed bot with a verified public webhook, hashed expiring one-use client links and company-scoped conversations; notifications use persisted document deduplication and never cause a saved sale to retry on delivery failure.
- Telegram ordering Mini App (/telegram/catalogo) authenticates by an HMAC of the chat id signed with the webhook secret and requires an active link; prices are read server-side and orders use a client UUID — the gateway hides the bot token so initData cannot be verified, and retries never duplicate.
- Reports use data-only `Reporte` objects and one exporter for screen/PDF/Excel with config_fiscal letterhead. Truck estimates use the route resolver and shared estimarCarga helper; missing prices leave totals/profit unavailable, never fabricated zero-price losses.
- Truck inventory uses company-scoped loads and atomic authenticated PostgreSQL RPCs for warehouse transfers, onboard sales, annulment and closure; sales carry carga_id through the offline outbox and never deduct warehouse stock twice. Load/closure require connectivity; offline sales subtract pending quantities locally until confirmed.
- Truck free stock uses disponibleCamion for sale, screen and exports; confirmed sales and cancelled pedidos release reservations, never add physical stock. Server reservation/closure filters exclude cancelado; cancellation invalidates cargas_camion. Waste uses registrar_merma_camion with stable UUID, company/load authorization and required reason; closure never double-deducts waste.
- Pricing: one resolver (resolverPrecio in src/lib/precios.ts) decides route prices in sales, orders and Telegram by priority client-special-for-route → client-special-all-routes → route list, never falling back to client lists or general catalog prices when a route is present; this prevents edits leaking across routes. Honor validity dates and reject missing/conflicting prices; cache all pricing data offline and preserve saved line prices. Non-route legacy reads keep compatibility fallback.
- Company switching cancels in-flight queries, refreshes the profile, resets (rather than clears) observed queries and remounts page content by organization ID — keeps the current screen fresh and discards previous-company local selections.
- Configurable select options live in catalogo_opciones (per company, stable codigo + editable etiqueta, protegido for Hacienda/system codes) or in their own tables (categorias, categorias_gasto, rutas with activo/orden); selectors offer only active options but keep a saved inactive value — one source of truth, history never breaks.
- Global route closure (cierre_global_ruta RPC) records sold = remaining − returned − waste at route prices as a client-less sale, route credit in creditos.ruta_id and cash difference in cierres_ruta, then reuses cerrar_carga_camion — keeps Wednesday settlements out of client portfolios.
- Collection reports attribute payments through their credit's route, then its sale's route, with client-route fallback only for legacy records without either — preserves route ownership and includes fully paid credits' payments.
- Dashboard and collections share exclusive route ownership in cobranza-rutas; payment/debt dialogs receive scoped credit IDs and ambiguous legacy debts stay unassigned — prevents mixed balances and cross-route payments.
- Historical costs are frozen: detalle_ventas.costo_unitario is set on insert and cargas_camion_detalle.costo_unitario on closure (triggers); closed loads only change via the admin editar_costo_carga RPC — price-list edits never alter closed profitability.
