import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/inventario")({
  beforeLoad: () => {
    throw redirect({ to: "/productos", replace: true });
  },
  component: () => null,
});