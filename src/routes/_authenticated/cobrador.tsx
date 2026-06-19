import { createFileRoute } from "@tanstack/react-router";
import { CobranzaPage } from "./cobranza";

export const Route = createFileRoute("/_authenticated/cobrador")({
  component: CobranzaPage,
});