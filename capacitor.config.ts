import type { CapacitorConfig } from "@capacitor/cli";

// La app web se sirve desde el dominio publicado (TanStack Start no genera
// un index.html estático). El service worker la cachea para uso sin conexión.
const config: CapacitorConfig = {
  appId: "com.rutadirecto.app",
  appName: "Ruta Directo",
  webDir: "public",
  server: {
    url: "https://rutadirecto.ingsoftcr.com",
    cleartext: false,
  },
  android: { allowMixedContent: false },
};

export default config;
