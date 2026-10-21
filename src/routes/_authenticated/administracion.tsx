import { ConfigFiscal } from "@/components/ConfigFiscal";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CatalogoDialog, useCatalogo } from "@/components/CatalogSelect";
import { UsuariosPage } from "./usuarios";
import { AuditoriaPage } from "./auditoria";
import { Map } from "lucide-react";
import { EmpresasAdmin } from "@/components/EmpresasAdmin";
import { EmpresaPerfil } from "@/components/EmpresaPerfil";
import { CatalogosAdmin } from "@/components/CatalogosAdmin";
import { ListasPrecios } from "@/components/ListasPrecios";
import { useListasPrecios } from "@/lib/listas-precios";
import { useRutas } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/administracion")({
  head: () => ({
    meta: [
      { title: "Administración — Ruta Directo" },
      { name: "description", content: "Usuarios, auditoría y rutas de Ruta Directo." },
      { property: "og:title", content: "Administración — Ruta Directo" },
      { property: "og:description", content: "Usuarios, auditoría y rutas de Ruta Directo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdministracionPage,
});

function AdministracionPage() {
  const { isAdmin, esSuperadmin } = useAuth();
  if (!isAdmin) {
    return <div className="p-6 text-muted-foreground">Solo los administradores pueden ver esta sección.</div>;
  }
  return (
    <div>
      <PageHeader title="Administración" subtitle="Empresa, usuarios, auditoría y rutas" />
      <div className="p-4 md:p-6">
        <Tabs defaultValue="empresa">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="empresa">Empresa</TabsTrigger>
            <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
            <TabsTrigger value="rutas">Rutas</TabsTrigger>
            <TabsTrigger value="precios">Precios</TabsTrigger>
            <TabsTrigger value="catalogos">Catálogos</TabsTrigger>
            <TabsTrigger value="auditoria">Auditoría</TabsTrigger>
            <TabsTrigger value="fiscal">Facturación</TabsTrigger>
            {esSuperadmin && <TabsTrigger value="empresas">Empresas</TabsTrigger>}
          </TabsList>
          <TabsContent value="empresa"><EmpresaPerfil /></TabsContent>
          <TabsContent value="usuarios" className="-mx-4 md:-mx-6"><UsuariosPage /></TabsContent>
          <TabsContent value="rutas"><RutasAdmin /></TabsContent>
          <TabsContent value="precios"><ListasPrecios /></TabsContent>
          <TabsContent value="catalogos"><CatalogosAdmin /></TabsContent>
          <TabsContent value="auditoria" className="-mx-4 md:-mx-6"><AuditoriaPage /></TabsContent>
          <TabsContent value="fiscal"><ConfigFiscal /></TabsContent>
          {esSuperadmin && <TabsContent value="empresas"><EmpresasAdmin /></TabsContent>}
        </Tabs>
      </div>
    </div>
  );
}

function RutaListaCard({ id, nombre }: { id: string; nombre: string }) {
  const qc = useQueryClient();
  const { data: rutas = [] } = useRutas();
  const { data: listas = [] } = useListasPrecios();
  const ruta = rutas.find((r) => r.id === id);
  const { data: clientes = 0 } = useQuery({ queryKey: ["cliente_rutas", "count", id], queryFn: async () => {
    const { count, error } = await supabase.from("cliente_rutas").select("id", { count: "exact", head: true }).eq("ruta_id", id);
    if (error) throw error; return count ?? 0;
  } });
  async function asignar(lista: string) {
    const { error } = await supabase.from("rutas").update({ lista_precio_id: lista || null }).eq("id", id);
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["rutas"] });
    toast.success(lista ? "Lista de precios asignada a la ruta" : "Ruta sin lista: productos sin precio especial quedan bloqueados");
  }
  return (
    <Card className="space-y-2 p-4">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary"><Map className="h-5 w-5" /></div>
        <div className="min-w-0"><p className="font-semibold">{nombre}</p><p className="text-xs text-muted-foreground">{ruta?.dia ? `Día: ${ruta.dia} · ` : ""}{clientes} cliente(s)</p></div>
      </div>
      <label className="block text-xs text-muted-foreground" htmlFor={`lista-ruta-${id}`}>Lista de precios de la ruta</label>
      <select id={`lista-ruta-${id}`} className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={ruta?.lista_precio_id ?? ""} onChange={(e) => asignar(e.target.value)}>
        <option value="">Sin lista asignada</option>
        {listas.map((l) => <option key={l.id} value={l.id}>{l.nombre}{l.activo ? "" : " (inactiva)"}</option>)}
      </select>
    </Card>
  );
}

function RutasAdmin() {
  const [abierto, setAbierto] = useState(false);
  const qc = useQueryClient();
  const { data: rutas = [] } = useCatalogo("rutas");
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Rutas de distribución</h2>
        <Button size="sm" onClick={() => setAbierto(true)}>Agregar / editar rutas</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {rutas.map((r) => <RutaListaCard key={r.id} id={r.id} nombre={r.nombre} />)}
        {rutas.length === 0 && <p className="text-sm text-muted-foreground">No hay rutas registradas.</p>}
      </div>
      <CatalogoDialog
        catalogo="rutas"
        abierto={abierto}
        cerrar={() => {
          setAbierto(false);
          qc.invalidateQueries({ queryKey: ["dashboard"] });
          qc.invalidateQueries({ queryKey: ["catalogo", "rutas"] });
          qc.invalidateQueries({ queryKey: ["rutas"] });
        }}
      />
    </div>
  );
}
