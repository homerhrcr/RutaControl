import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "./dashboard";

export const Route = createFileRoute("/_authenticated/rutas")({
  head: () => ({
    meta: [
      { title: "Resumen de Rutas — Ruta Directo" },
      { name: "description", content: "Indicadores de distribución de Ruta Directo." },
      { property: "og:title", content: "Resumen de Rutas — Ruta Directo" },
      { property: "og:description", content: "Indicadores de distribución de Ruta Directo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});