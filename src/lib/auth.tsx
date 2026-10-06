import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export type AppRole = "administrador" | "vendedor" | "cobrador";

export interface Organizacion {
  id: string;
  nombre: string;
  codigo: string;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  nombre: string;
  loading: boolean;
  isAdmin: boolean;
  esSuperadmin: boolean;
  organizaciones: Organizacion[];
  organizacionActiva: Organizacion | null;
  cambiarOrganizacion: (id: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const [esSuperadmin, setEsSuperadmin] = useState(false);
  const [organizaciones, setOrganizaciones] = useState<Organizacion[]>([]);
  const [orgActivaId, setOrgActivaId] = useState<string | null>(null);

  async function loadProfile(uid: string) {
    const [{ data: superadmin }, { data: orgId }, { data: members }, { data: orgs }, { data: profile }] =
      await Promise.all([
        supabase.rpc("is_platform_admin", { _uid: uid }),
        supabase.rpc("current_organization_id"),
        supabase.from("organization_members").select("organization_id, role").eq("user_id", uid).eq("estado", "active"),
        supabase.from("organizations").select("id, nombre, codigo").eq("estado", "active").order("nombre"),
        supabase.from("profiles").select("nombre").eq("id", uid).maybeSingle(),
      ]);
    const sa = superadmin === true;
    setEsSuperadmin(sa);
    setOrgActivaId((orgId as string | null) ?? null);
    setOrganizaciones((orgs ?? []) as Organizacion[]);
    const r = (members ?? []).filter((m) => m.organization_id === orgId).map((m) => m.role as AppRole);
    if (sa && !r.includes("administrador")) r.push("administrador");
    setRoles(r);
    setNombre(profile?.nombre ?? "");
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => loadProfile(sess.user.id), 0);
      } else {
        setRoles([]);
        setNombre("");
        setOrganizaciones([]);
        setOrgActivaId(null);
        setEsSuperadmin(false);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        loadProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function refreshProfile() {
    if (user) await loadProfile(user.id);
  }

  async function cambiarOrganizacion(id: string) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw new Error("Necesita conexión para cambiar de empresa");
    }
    const { error } = await supabase.rpc("set_default_organization", { p_org: id });
    if (error) throw new Error(error.message);
    queryClient.clear();
    if (user) await loadProfile(user.id);
    await queryClient.invalidateQueries();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        roles,
        nombre,
        loading,
        isAdmin: roles.includes("administrador"),
        esSuperadmin,
        organizaciones,
        organizacionActiva: organizaciones.find((o) => o.id === orgActivaId) ?? null,
        cambiarOrganizacion,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
