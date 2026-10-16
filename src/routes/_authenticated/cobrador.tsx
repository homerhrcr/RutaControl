import { createFileRoute } from "@tanstack/react-router";
import { CobranzaPage } from "./cobranza";

export const Route = createFileRoute("/_authenticated/cobrador")({
  head: () => ({
    meta: [
      { title: "Cobranza en ruta — Ruta Directo" },
      { name: "description", content: "Cobros y saldos de clientes de Ruta Directo." },
      { property: "og:title", content: "Cobranza en ruta — Ruta Directo" },
      { property: "og:description", content: "Cobros y saldos de clientes de Ruta Directo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CobranzaPage,
});