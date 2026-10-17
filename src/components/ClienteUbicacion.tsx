/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Copy, ClipboardPaste, Crosshair, MapPin, Loader2, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { cargarMapaCliente } from "@/lib/google-maps-loader";
import { leerCoordenadas, pegarCoordenadas } from "@/lib/coordenadas";

type Posicion = { lat: number; lng: number };
type Props = { latitud: string; longitud: string; onChange: (lat: string, lng: string) => void };

export function ClienteUbicacion({ latitud, longitud, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [gps, setGps] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [seleccion, setSeleccion] = useState<Posicion | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const marker = useRef<google.maps.Marker | null>(null);
  const colocar = useRef<(pos: Posicion) => void>(() => {});
  let posicion: Posicion | null = null;
  try { posicion = leerCoordenadas(latitud, longitud); } catch { /* Validar al guardar. */ }

  const actualizar = (pos: Posicion) => onChange(pos.lat.toFixed(6), pos.lng.toFixed(6));

  function capturar(enMapa = false) {
    if (!navigator.geolocation) { toast.error("GPS no disponible"); return; }
    setGps(true);
    navigator.geolocation.getCurrentPosition((p) => {
      const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
      if (enMapa) {
        colocar.current(pos);
        map.current?.setCenter(pos);
        map.current?.setZoom(18);
      } else actualizar(pos);
      setGps(false);
      toast.success("Ubicación capturada");
    }, (e) => {
      setGps(false);
      toast.error(e.code === 1 ? "Permita el acceso a su ubicación para usar el GPS." : "No se pudo obtener la ubicación. Puede ingresar las coordenadas.");
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    let inicial: Posicion | null = null;
    try { inicial = leerCoordenadas(latitud, longitud); } catch { /* Centro por defecto. */ }
    setSeleccion(inicial);
    setError("");
    colocar.current = setSeleccion;
    if (!navigator.onLine) { setError("Sin conexión: puede usar el GPS o ingresar las coordenadas."); return; }
    setLoading(true);
    void cargarMapaCliente().then(() => {
      if (cancelado || !container.current) return;
      const mapa = new google.maps.Map(container.current, {
        center: inicial ?? { lat: 9.9281, lng: -84.0907 }, zoom: inicial ? 17 : 9,
        mapTypeId: "hybrid", mapTypeControl: true,
        mapTypeControlOptions: { mapTypeIds: ["hybrid", "roadmap"] },
        streetViewControl: false, fullscreenControl: false, clickableIcons: false,
      });
      map.current = mapa;
      colocar.current = (pos) => {
        setSeleccion(pos);
        if (marker.current) marker.current.setPosition(pos);
        else {
          const pin = new google.maps.Marker({ map: mapa, position: pos, draggable: true });
          marker.current = pin;
          pin.addListener("dragend", (e: google.maps.MapMouseEvent) => {
            if (e.latLng) setSeleccion({ lat: e.latLng.lat(), lng: e.latLng.lng() });
          });
        }
      };
      if (inicial) colocar.current(inicial);
      mapa.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (e.latLng) colocar.current({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      });
      setLoading(false);
    }).catch((e: unknown) => {
      if (!cancelado) { setLoading(false); setError(e instanceof Error ? e.message : "No se pudo cargar el mapa."); }
    });
    return () => {
      cancelado = true;
      if (marker.current) { google.maps.event.clearInstanceListeners(marker.current); marker.current.setMap(null); }
      if (map.current) google.maps.event.clearInstanceListeners(map.current);
      marker.current = null;
      map.current = null;
    };
  }, [open, latitud, longitud]);

  return <section className="space-y-3 border-t pt-3">
    <Label>Ubicación del cliente</Label>
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5"><Label htmlFor="cliente-latitud">Latitud</Label><Input id="cliente-latitud" inputMode="decimal" placeholder="9.928100" value={latitud} onChange={(e) => onChange(e.target.value, longitud)} /></div>
      <div className="space-y-1.5"><Label htmlFor="cliente-longitud">Longitud</Label><Input id="cliente-longitud" inputMode="decimal" placeholder="-84.090700" value={longitud} onChange={(e) => onChange(latitud, e.target.value)} /></div>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" disabled={gps} onClick={() => capturar()}>{gps ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />} Usar mi ubicación</Button>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}><MapPin className="h-4 w-4" /> Marcar en el mapa</Button>
      <Button type="button" size="icon" variant="ghost" title="Copiar coordenadas" aria-label="Copiar coordenadas" disabled={!posicion} onClick={async () => {
        if (!posicion) return;
        try { await navigator.clipboard.writeText(`${posicion.lat.toFixed(6)}, ${posicion.lng.toFixed(6)}`); toast.success("Coordenadas copiadas"); } catch { toast.error("No se pudo copiar."); }
      }}><Copy className="h-4 w-4" /></Button>
      <Button type="button" size="icon" variant="ghost" title="Pegar coordenadas" aria-label="Pegar coordenadas" onClick={async () => {
        try { actualizar(pegarCoordenadas(await navigator.clipboard.readText())); } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo leer el portapapeles."); }
      }}><ClipboardPaste className="h-4 w-4" /></Button>
      <Button type="button" size="icon" variant="ghost" title="Borrar ubicación" aria-label="Borrar ubicación" disabled={!latitud && !longitud} onClick={() => onChange("", "")}><X className="h-4 w-4" /></Button>
    </div>
    {posicion && <Button asChild variant="link" size="sm"><a href={`https://www.google.com/maps/search/?api=1&query=${posicion.lat},${posicion.lng}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Abrir en Google Maps</a></Button>}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>Marcar ubicación del cliente</DialogTitle></DialogHeader>
        <div className="relative h-[420px] max-h-[50vh] overflow-hidden rounded-md border bg-muted">
          <div ref={container} className="h-full w-full" />
          {(loading || error) && <div className="absolute inset-0 flex items-center justify-center gap-2 bg-muted p-5 text-center text-sm text-muted-foreground">{loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Cargando mapa…</> : error}</div>}
        </div>
        <p className="text-sm text-muted-foreground">{seleccion ? `${seleccion.lat.toFixed(6)}, ${seleccion.lng.toFixed(6)}` : "Sin coordenadas seleccionadas"}</p>
        <DialogFooter className="flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={gps} onClick={() => capturar(true)}><Crosshair className="h-4 w-4" /> Mi ubicación</Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="button" disabled={!seleccion} onClick={() => { if (seleccion) { actualizar(seleccion); setOpen(false); } }}>Usar estas coordenadas</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}