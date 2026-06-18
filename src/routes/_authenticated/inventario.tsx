import { createFileRoute } from "@tanstack/react-router";
import { useProductos } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inventario")({
  component: InventarioPage,
});

function InventarioPage() {
  const { data: productos } = useProductos();
  const bajos = (productos ?? []).filter((p) => Number(p.existencia) <= Number(p.existencia_minima));

  return (
    <div>
      <PageHeader title="Inventario" subtitle={`${bajos.length} producto(s) con faltante`} />
      <div className="space-y-4 p-4 md:p-6">
        {bajos.length > 0 && (
          <Card className="border-destructive/30 bg-destructive/5 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <AlertTriangle className="h-4 w-4" /> Productos por debajo del mínimo
            </p>
          </Card>
        )}
        <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
          {(productos ?? []).map((p) => {
            const bajo = Number(p.existencia) <= Number(p.existencia_minima);
            return (
              <Card key={p.id} className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{p.nombre}</p>
                  <p className="text-xs text-muted-foreground">Mín: {Number(p.existencia_minima)}</p>
                </div>
                <Badge variant={bajo ? "outline" : "secondary"} className={bajo ? "border-destructive/40 text-destructive" : ""}>
                  {Number(p.existencia)} u.
                </Badge>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
