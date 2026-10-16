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

export const Route = createFileRoute("/_authenticated/administracion")({
  head: () => ({
    meta: [
      { title: "Administración — Ruta Directo" },
      { name: "description", content: "Usuarios, auditoría y rutas de Ruta Directo." },
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
      <PageHeader title="Administración" subtitle="Usuarios, auditoría y rutas" />
      <div className="p-4 md:p-6">
        <Tabs defaultValue="usuarios">
          <TabsList>
            <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
            <TabsTrigger value="rutas">Rutas</TabsTrigger>
            <TabsTrigger value="auditoria">Auditoría</TabsTrigger>
            <TabsTrigger value="fiscal">Facturación</TabsTrigger>
            {esSuperadmin && <TabsTrigger value="empresas">Empresas</TabsTrigger>}
          </TabsList>
          <TabsContent value="usuarios" className="-mx-4 md:-mx-6"><UsuariosPage /></TabsContent>
          <TabsContent value="rutas"><RutasAdmin /></TabsContent>
          <TabsContent value="auditoria" className="-mx-4 md:-mx-6"><AuditoriaPage /></TabsContent>
          <TabsContent value="fiscal"><ConfigFiscal /></TabsContent>
          {esSuperadmin && <TabsContent value="empresas"><EmpresasAdmin /></TabsContent>}
        </Tabs>
      </div>
    </div>
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
        {rutas.map((r) => (
          <Card key={r.id} className="flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary"><Map className="h-5 w-5" /></div>
            <span className="font-semibold">{r.nombre}</span>
          </Card>
        ))}
        {rutas.length === 0 && <p className="text-sm text-muted-foreground">No hay rutas registradas.</p>}
      </div>
      <CatalogoDialog
        catalogo="rutas"
        abierto={abierto}
        cerrar={() => {
          setAbierto(false);
          qc.invalidateQueries({ queryKey: ["dashboard"] });
          qc.invalidateQueries({ queryKey: ["catalogo", "rutas"] });
        }}
      />
    </div>
  );
}
