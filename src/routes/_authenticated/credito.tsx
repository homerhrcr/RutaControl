import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/credito")({
  beforeLoad: () => {
    throw redirect({ to: "/cobranza", replace: true });
  },
  component: () => null,
});