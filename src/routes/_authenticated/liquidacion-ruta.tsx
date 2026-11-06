import { createFileRoute } from "@tanstack/react-router";
import { CargaCamionPage } from "./carga-camion";

export const Route = createFileRoute("/_authenticated/liquidacion-ruta")({
  head: () => ({ meta: [
    { title: "Liquidación de ruta — Ruta Directo" },
    { name: "description", content: "Rutas finalizadas pendientes de liquidar y rutas ya liquidadas." },
    { property: "og:title", content: "Liquidación de ruta — Ruta Directo" },
    { property: "og:description", content: "Entrega del camión, sobrantes, mermas y cuadre de dineros por ruta." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <CargaCamionPage modo="liquidacion" />,
});
