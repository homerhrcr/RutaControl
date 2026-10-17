/// <reference types="google.maps" />
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClientes, useRutas, useInvalidate } from "@/lib/data";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CatalogSelect } from "@/components/CatalogSelect";
import {
  MapPin,
  Crosshair,
  X,
  Loader2,
  Satellite,
  Map as MapIcon,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/mapa-rutas")({
  head: () => ({
    meta: [
      { title: "Mapa de Rutas — Ruta Directo" },
      { name: "description", content: "Ubicaciones de los clientes en Google Maps, separadas por ruta." },
      { property: "og:title", content: "Mapa de Rutas — Ruta Directo" },
      { property: "og:description", content: "Ubicaciones de los clientes en Google Maps, separadas por ruta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MapaRutasPage,
});

// Paleta de colores por ruta
const COLORS = [
  "#e11d48",
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#9333ea",
  "#0891b2",
  "#db2777",
  "#65a30d",
];

// Centro por defecto: Costa Rica
const DEFAULT_CENTER = { lat: 9.9281, lng: -84.0907 };

// Tipo de mapa: satelital por defecto, con opción de pasar al clásico
type TipoMapa = "satellite" | "roadmap";
const TIPO_MAPA_KEY = "rutadirecto_mapa_tipo";
const TIPO_MAPA_LABEL: Record<TipoMapa, string> = {
  satellite: "Satelital",
  roadmap: "Clásico",
};

function leerTipoMapa(): TipoMapa {
  try {
    const v = localStorage.getItem(TIPO_MAPA_KEY);
    if (v === "roadmap" || v === "satellite") return v;
  } catch {
    // almacenamiento no disponible
  }
  return "satellite";
}

declare global {
  interface Window {
    google?: typeof google;
    __initMapaRutas?: () => void;
  }
}

function useGoogleMaps() {
  const [ready, setReady] = useState(!!window.google?.maps);

  useEffect(() => {
    if (window.google?.maps) {
      setReady(true);
      return;
    }
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
    const existing = document.getElementById("gmaps-script");
    window.__initMapaRutas = () => setReady(true);
    if (existing) return;
    const script = document.createElement("script");
    script.id = "gmaps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__initMapaRutas${
      channel ? `&channel=${channel}` : ""
    }`;
    script.async = true;
    document.head.appendChild(script);
  }, []);

  return ready;
}

interface ClienteMapa {
  id: string;
  nombre: string;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
  rutas: { id: string; nombre: string }[];
  rutaId: string | null;
  rutaNombre: string | null;
}

function MapaRutasPage() {
  const ready = useGoogleMaps();
  const { data: rutas } = useRutas();
  const { data: clientesRaw } = useClientes();
  const invalidate = useInvalidate();

  const [rutaFiltro, setRutaFiltro] = useState<string>("todas");
  const [marcando, setMarcando] = useState<ClienteMapa | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [tipoMapa, setTipoMapa] = useState<TipoMapa>("satellite");

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);
  const infoWindow = useRef<google.maps.InfoWindow | null>(null);
  const marcandoRef = useRef<ClienteMapa | null>(null);
  marcandoRef.current = marcando;

  // Recuperar el tipo de mapa elegido la última vez
  useEffect(() => {
    setTipoMapa(leerTipoMapa());
  }, []);

  // Mapa de color por ruta
  const colorPorRuta = useMemo(() => {
    const m = new Map<string, string>();
    (rutas ?? []).forEach((r, i) => m.set(r.id, COLORS[i % COLORS.length]));
    return m;
  }, [rutas]);

  const clientes: ClienteMapa[] = useMemo(() => {
    return (clientesRaw ?? []).map((c: Record<string, unknown>) => {
      const crs = (c.cliente_rutas as Array<Record<string, unknown>> | undefined) ?? [];
      const rutas = crs
        .map((cr) => ({
          id: (cr?.ruta_id as string | undefined) ?? null,
          nombre:
            ((cr?.rutas as { nombre?: string } | undefined)?.nombre as
              | string
              | undefined) ?? null,
        }))
        .filter((r): r is { id: string; nombre: string } => r.id != null);
      return {
        id: c.id as string,
        nombre: c.nombre as string,
        direccion: (c.direccion as string | null) ?? null,
        latitud: c.latitud != null ? Number(c.latitud) : null,
        longitud: c.longitud != null ? Number(c.longitud) : null,
        rutas,
        rutaId: rutas[0]?.id ?? null,
        rutaNombre: rutas.map((r) => r.nombre).join(", ") || null,
      };
    });
  }, [clientesRaw]);

  const visibles = useMemo(
    () =>
      clientes.filter(
        (c) =>
          rutaFiltro === "todas" || c.rutas.some((r) => r.id === rutaFiltro),
      ),
    [clientes, rutaFiltro],
  );

  const conUbicacion = visibles.filter((c) => c.latitud != null && c.longitud != null);
  const sinUbicacion = visibles.filter((c) => c.latitud == null || c.longitud == null);

  // Inicializar mapa
  useEffect(() => {
    if (!ready || !mapRef.current || mapInstance.current) return;
    mapInstance.current = new google.maps.Map(mapRef.current, {
      center: DEFAULT_CENTER,
      zoom: 9,
      mapTypeId: tipoMapa,
      mapTypeControl: false,
      streetViewControl: false,
      clickableIcons: false,
    });
    infoWindow.current = new google.maps.InfoWindow();

    mapInstance.current.addListener("click", (e: google.maps.MapMouseEvent) => {
      const target = marcandoRef.current;
      if (!target || !e.latLng) return;
      void guardarUbicacion(target, e.latLng.lat(), e.latLng.lng());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Pintar marcadores
  useEffect(() => {
    if (!ready || !mapInstance.current) return;
    markers.current.forEach((m) => m.setMap(null));
    markers.current = [];

    const bounds = new google.maps.LatLngBounds();
    let count = 0;

    conUbicacion.forEach((c) => {
      const colorRutaId =
        rutaFiltro !== "todas" && c.rutas.some((r) => r.id === rutaFiltro)
          ? rutaFiltro
          : c.rutaId;
      const color = colorRutaId ? colorPorRuta.get(colorRutaId) ?? "#64748b" : "#64748b";
      const pos = { lat: c.latitud!, lng: c.longitud! };
      const marker = new google.maps.Marker({
        position: pos,
        map: mapInstance.current!,
        title: c.nombre,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      marker.addListener("click", () => {
        infoWindow.current?.setContent(
          `<div style="font-size:13px"><strong>${c.nombre}</strong><br/>${
            c.rutaNombre ?? "Sin ruta"
          }${c.direccion ? `<br/>${c.direccion}` : ""}</div>`,
        );
        infoWindow.current?.open(mapInstance.current!, marker);
      });
      markers.current.push(marker);
      bounds.extend(pos);
      count++;
    });

    if (count > 0) {
      mapInstance.current.fitBounds(bounds, 60);
      if (count === 1) mapInstance.current.setZoom(15);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, conUbicacion, colorPorRuta, rutaFiltro]);

  // Cambiar entre satelital y clásico, y recordar la elección
  useEffect(() => {
    if (!ready || !mapInstance.current) return;
    mapInstance.current.setMapTypeId(tipoMapa);
    try {
      localStorage.setItem(TIPO_MAPA_KEY, tipoMapa);
    } catch {
      // almacenamiento no disponible
    }
  }, [ready, tipoMapa]);

  async function guardarUbicacion(c: ClienteMapa, lat: number, lng: number) {
    setGuardando(true);
    const { error } = await supabase
      .from("clientes")
      .update({ latitud: lat, longitud: lng })
      .eq("id", c.id);
    setGuardando(false);
    if (error) {
      toast.error("No se pudo guardar la ubicación");
      return;
    }
    toast.success(`Ubicación guardada para ${c.nombre}`);
    setMarcando(null);
    invalidate(["clientes"]);
  }

  return (
    <div>
      <PageHeader title="Mapa de Rutas" subtitle="Ubicaciones de clientes por ruta" />
      <div className="space-y-4 p-4">
        <Card className="flex flex-wrap items-center gap-3 p-4">
          <div className="w-56">
            <CatalogSelect
              catalogo="rutas"
              label="Ruta"
              placeholder="Filtrar por ruta"
              value={rutaFiltro}
              onChange={setRutaFiltro}
              extraOptions={[{ value: "todas", label: "Todas las rutas" }]}
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg border p-1">
            {(["satellite", "roadmap"] as TipoMapa[]).map((t) => (
              <Button
                key={t}
                size="sm"
                variant={tipoMapa === t ? "default" : "ghost"}
                className="h-7 px-2.5 text-xs"
                onClick={() => setTipoMapa(t)}
              >
                {t === "satellite" ? (
                  <Satellite className="mr-1 h-3.5 w-3.5" />
                ) : (
                  <MapIcon className="mr-1 h-3.5 w-3.5" />
                )}
                {TIPO_MAPA_LABEL[t]}
              </Button>
            ))}
          </div>
          <div className="text-sm text-muted-foreground">
            {conUbicacion.length} ubicada(s) · {sinUbicacion.length} sin ubicación
          </div>
          {/* Leyenda de colores */}
          <div className="flex flex-wrap gap-3">
            {(rutas ?? [])
              .filter((r) => rutaFiltro === "todas" || r.id === rutaFiltro)
              .map((r) => (
                <span key={r.id} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: colorPorRuta.get(r.id) }}
                  />
                  {r.nombre}
                </span>
              ))}
          </div>
        </Card>

        {marcando && (
          <Card className="flex items-center justify-between gap-3 border-primary bg-primary/5 p-3">
            <div className="flex items-center gap-2 text-sm">
              {guardando ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Crosshair className="h-4 w-4 text-primary" />
              )}
              <span>
                Toca el mapa para marcar la ubicación de{" "}
                <strong>{marcando.nombre}</strong>
              </span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setMarcando(null)}>
              <X className="h-4 w-4" />
            </Button>
          </Card>
        )}

        <Card className="overflow-hidden p-0">
          {!ready ? (
            <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando mapa…
            </div>
          ) : (
            <div ref={mapRef} className="h-[60vh] w-full" />
          )}
        </Card>

        {sinUbicacion.length > 0 && (
          <Card className="p-4">
            <p className="mb-3 text-sm font-semibold">
              Clientes sin ubicación ({sinUbicacion.length})
            </p>
            <div className="space-y-2">
              {sinUbicacion.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-lg border p-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.nombre}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.rutaNombre ?? "Sin ruta"}
                      {c.direccion ? ` · ${c.direccion}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={marcando?.id === c.id ? "default" : "outline"}
                    onClick={() =>
                      setMarcando((prev) => (prev?.id === c.id ? null : c))
                    }
                  >
                    <MapPin className="mr-1 h-4 w-4" />
                    Marcar
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
