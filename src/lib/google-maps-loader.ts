/// <reference types="google.maps" />
let pendiente: Promise<void> | null = null;

export function cargarMapaCliente(): Promise<void> {
  if (window.google?.maps?.Map) return Promise.resolve();
  if (pendiente) return pendiente;
  pendiente = new Promise<void>((resolve, reject) => {
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    if (!key) { reject(new Error("Google Maps no está configurado.")); return; }
    const timer = window.setTimeout(() => reject(new Error("No se pudo cargar Google Maps.")), 20000);
    const anterior = window.__initMapaRutas;
    window.__initMapaRutas = () => {
      window.clearTimeout(timer);
      anterior?.();
      resolve();
    };
    if (document.getElementById("gmaps-script")) return;
    const script = document.createElement("script");
    script.id = "gmaps-script";
    const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__initMapaRutas${channel ? `&channel=${channel}` : ""}`;
    script.async = true;
    script.onerror = () => { window.clearTimeout(timer); reject(new Error("No se pudo cargar Google Maps.")); };
    document.head.appendChild(script);
  }).catch((error: unknown) => { pendiente = null; throw error; });
  return pendiente;
}