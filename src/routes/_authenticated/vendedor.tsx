import { createFileRoute } from "@tanstack/react-router";
import { RutaPage } from "./ruta";

export const Route = createFileRoute("/_authenticated/vendedor")({
  head: () => ({
    meta: [
      { title: "Vendedor — Ruta Directo" },
      { name: "description", content: "Ventas en ruta de Ruta Directo." },
      { property: "og:title", content: "Vendedor — Ruta Directo" },
      { property: "og:description", content: "Ventas en ruta de Ruta Directo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RutaPage,
});