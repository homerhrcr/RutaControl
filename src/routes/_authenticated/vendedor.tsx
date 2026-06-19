import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/vendedor")({
  beforeLoad: () => {
    throw redirect({ to: "/ruta", replace: true });
  },
  component: () => null,
});