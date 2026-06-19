import { createFileRoute } from "@tanstack/react-router";
import { CobranzaPage } from "./cobranza";

export const Route = createFileRoute("/_authenticated/credito")({
  component: CobranzaPage,
});