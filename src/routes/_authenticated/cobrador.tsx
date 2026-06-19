import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/cobrador")({
  component: () => <Navigate to="/cobranza" replace />,
});