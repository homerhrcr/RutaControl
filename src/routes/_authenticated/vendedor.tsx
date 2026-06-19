import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/vendedor")({
  component: () => <Navigate to="/ruta" replace />,
});