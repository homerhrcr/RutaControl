import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Inicio — Ruta Directo" },
      { name: "description", content: "Acceso a las rutas de venta de Ruta Directo." },
      { property: "og:title", content: "Inicio — Ruta Directo" },
      { property: "og:description", content: "Acceso a las rutas de venta de Ruta Directo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  ssr: false,
  component: () => <Navigate to="/ruta" replace />,
});
