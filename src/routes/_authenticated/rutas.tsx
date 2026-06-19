import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/rutas")({
  component: () => <Navigate to="/dashboard" replace />,
});