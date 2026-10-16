import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/ventas")({
  head: () => ({
    meta: [
      { title: "Ventas — Ruta Directo" },
      { name: "description", content: "Consulta de ventas de Ruta Directo." },
      { property: "og:title", content: "Ventas — Ruta Directo" },
      { property: "og:description", content: "Consulta de ventas de Ruta Directo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Navigate to="/dashboard" replace />,
});
