import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLES = ["administrador", "vendedor", "cobrador"] as const;

/** Verifies caller is admin of the active company and returns that company id. */
async function assertAdmin(context: { supabase: any; userId: string }): Promise<string> {
  const [{ data: isAdmin, error }, { data: orgId }] = await Promise.all([
    context.supabase.rpc("is_admin", { _user_id: context.userId }),
    context.supabase.rpc("current_organization_id"),
  ]);
  if (error) throw new Error(error.message);
  if (!isAdmin || !orgId) throw new Error("Forbidden");
  return orgId as string;
}

async function assertSuperadmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("is_platform_admin", { _uid: context.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Solo el Superadmin puede hacer esto");
}

export const listUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const orgId = await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: members } = await supabaseAdmin
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", orgId);
    const ids = (members ?? []).map((m) => m.user_id);
    if (ids.length === 0) return [];

    const [{ data: profiles }, authList] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, nombre, telefono, created_at").in("id", ids),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    const emailById = new Map<string, string>();
    for (const u of authList.data?.users ?? []) emailById.set(u.id, u.email ?? "");

    return (profiles ?? []).map((p) => ({
      id: p.id,
      nombre: p.nombre ?? "",
      telefono: p.telefono ?? "",
      email: emailById.get(p.id) ?? "",
      roles: (members ?? []).filter((m) => m.user_id === p.id).map((m) => m.role as string),
      created_at: p.created_at,
    }));
  });

export const createUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        password: z.string().min(6).max(72),
        nombre: z.string().trim().min(1).max(100),
        telefono: z.string().trim().max(30).optional().default(""),
        role: z.enum(ROLES),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const orgId = await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let uid: string;
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nombre: data.nombre },
    });
    if (error) {
      // Existing account (e.g. member of another company): attach it to this company.
      const list = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = list.data?.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
      if (!existing) throw new Error(error.message);
      uid = existing.id;
    } else {
      uid = created.user!.id;
      await supabaseAdmin.from("profiles").upsert({ id: uid, nombre: data.nombre, telefono: data.telefono });
    }

    const { error: mErr } = await supabaseAdmin
      .from("organization_members")
      .upsert({ organization_id: orgId, user_id: uid, role: data.role, estado: "active" }, { onConflict: "organization_id,user_id" });
    if (mErr) throw new Error(mErr.message);
    return { id: uid };
  });

export const updateUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        nombre: z.string().trim().min(1).max(100),
        telefono: z.string().trim().max(30).optional().default(""),
        role: z.enum(ROLES),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const orgId = await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: m } = await supabaseAdmin
      .from("organization_members").select("id").eq("organization_id", orgId).eq("user_id", data.id).maybeSingle();
    if (!m) throw new Error("El usuario no pertenece a esta empresa");

    await supabaseAdmin.from("profiles").update({ nombre: data.nombre, telefono: data.telefono }).eq("id", data.id);
    const { error } = await supabaseAdmin.from("organization_members").update({ role: data.role }).eq("id", m.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const orgId = await assertAdmin(context);
    if (data.id === context.userId) throw new Error("No puedes eliminar tu propio usuario");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("organization_members").delete().eq("organization_id", orgId).eq("user_id", data.id);
    // Delete the account only if it no longer belongs to any company and is not superadmin
    const [{ count }, { data: pa }] = await Promise.all([
      supabaseAdmin.from("organization_members").select("id", { count: "exact", head: true }).eq("user_id", data.id),
      supabaseAdmin.from("platform_admins").select("user_id").eq("user_id", data.id).maybeSingle(),
    ]);
    if (!count && !pa) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ---------- Empresas (solo Superadmin) ----------

export const listEmpresas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperadmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: orgs }, { data: members }] = await Promise.all([
      supabaseAdmin.from("organizations").select("id, nombre, codigo, estado, created_at").order("nombre"),
      supabaseAdmin.from("organization_members").select("organization_id"),
    ]);
    return (orgs ?? []).map((o) => ({
      ...o,
      miembros: (members ?? []).filter((m) => m.organization_id === o.id).length,
    }));
  });

export const guardarEmpresa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid().optional(),
        nombre: z.string().trim().min(2).max(120),
        estado: z.enum(["active", "inactive"]).default("active"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertSuperadmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("organizations")
        .update({ nombre: data.nombre, estado: data.estado, updated_at: new Date().toISOString() })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const codigo =
      data.nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "") +
      "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    const { data: org, error } = await supabaseAdmin
      .from("organizations").insert({ nombre: data.nombre, codigo }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: org.id };
  });
