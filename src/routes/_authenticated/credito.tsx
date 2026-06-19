import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/credito")({
  component: () => <Navigate to="/cobranza" replace />,
});