import { createFileRoute } from "@tanstack/react-router";
import { MapaRutas } from "@/components/MapaRutas";

export const Route = createFileRoute("/_authenticated/mapa-rutas")({
  head: () => ({
    meta: [
      { title: "Mapa de Rutas — Ruta Directo" },
      { name: "description", content: "Ubicación de los clientes y recorrido de cada ruta en el mapa." },
      { property: "og:title", content: "Mapa de Rutas — Ruta Directo" },
      { property: "og:description", content: "Ubicación de los clientes y recorrido de cada ruta en el mapa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MapaRutasPage,
});

function MapaRutasPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Mapa de Rutas</h1>
      <MapaRutas />
    </div>
  );
}
