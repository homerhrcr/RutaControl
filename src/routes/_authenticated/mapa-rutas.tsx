import { createFileRoute, redirect } from "@tanstack/react-router";

// El mapa de rutas ahora vive dentro de Iniciar Ruta (/ruta).
export const Route = createFileRoute("/_authenticated/mapa-rutas")({
  beforeLoad: () => {
    throw redirect({ to: "/ruta", replace: true });
  },
});
