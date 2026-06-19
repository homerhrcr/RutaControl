import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/cobrador")({
  beforeLoad: () => {
    throw redirect({ to: "/cobranza", replace: true });
  },
  component: () => null,
});