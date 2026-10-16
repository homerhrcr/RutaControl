import { createFileRoute } from "@tanstack/react-router";
import { CobranzaPage } from "./cobranza";

export const Route = createFileRoute("/_authenticated/credito")({
  head: () => ({
    meta: [
      { title: "Créditos — Ruta Directo" },
      { name: "description", content: "Consulta de créditos de Ruta Directo." },
      { property: "og:title", content: "Créditos — Ruta Directo" },
      { property: "og:description", content: "Consulta de créditos de Ruta Directo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CobranzaPage,
});