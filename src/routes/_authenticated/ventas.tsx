import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/ventas")({
  component: () => <Navigate to="/dashboard" replace />,
});
