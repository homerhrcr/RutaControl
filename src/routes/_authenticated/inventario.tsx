import { createFileRoute } from "@tanstack/react-router";
import { ProductosPage } from "./productos";

export const Route = createFileRoute("/_authenticated/inventario")({
  head: () => ({
    meta: [
      { title: "Inventario — Ruta Directo" },
      { name: "description", content: "Existencias de productos de Ruta Directo." },
      { property: "og:title", content: "Inventario — Ruta Directo" },
      { property: "og:description", content: "Existencias de productos de Ruta Directo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductosPage,
});