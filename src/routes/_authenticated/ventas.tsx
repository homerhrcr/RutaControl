import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCRC, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/ventas")({
  component: VentasPage,
});

function VentasPage() {
  const { data } = useQuery({
    queryKey: ["ventas-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ventas")
        .select("*, clientes(nombre), rutas(nombre)")
        .order("fecha", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <PageHeader title="Ventas" subtitle="Últimas 100 transacciones" />
      <div className="p-4 md:p-6">
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Ruta</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="whitespace-nowrap text-xs">{formatDateTime(v.fecha)}</TableCell>
                  <TableCell className="font-medium">{(v as any).clientes?.nombre ?? "—"}</TableCell>
                  <TableCell className="text-xs">{(v as any).rutas?.nombre ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={v.metodo_pago === "credito" ? "outline" : "secondary"}>{v.metodo_pago}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold">{formatCRC(v.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
