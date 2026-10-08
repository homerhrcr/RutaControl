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
