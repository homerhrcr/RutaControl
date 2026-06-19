import { createFileRoute } from "@tanstack/react-router";
import { ProductosPage } from "./productos";

export const Route = createFileRoute("/_authenticated/inventario")({
  component: ProductosPage,
});