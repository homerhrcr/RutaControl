import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/inventario")({
  component: () => <Navigate to="/productos" replace />,
});