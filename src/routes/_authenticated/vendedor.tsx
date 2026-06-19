import { createFileRoute } from "@tanstack/react-router";
import { RutaPage } from "./ruta";

export const Route = createFileRoute("/_authenticated/vendedor")({
  component: RutaPage,
});