import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { queueEvidencia } from "@/lib/offline";

function posicion(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60000 },
    );
  });
}

/**
 * Toma una foto con la cámara del dispositivo (input nativo: funciona en navegador,
 * PWA y en el WebView de Android) y la guarda localmente para subirla al reconectar.
 */
export function EvidenciaButton({ entidad, entidadId }: { entidad: string; entidadId: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const { user, organizacionActiva } = useAuth();
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file || !user || !organizacionActiva) return;
    setBusy(true);
    try {
      const gps = await posicion();
      await queueEvidencia({
        file,
        nombre: file.name,
        entidad,
        entidad_id: entidadId,
        usuario_id: user.id,
        organization_id: organizacionActiva.id,
        lat: gps?.lat,
        lng: gps?.lng,
      });
      toast.success(navigator.onLine ? "Foto guardada, subiendo…" : "Foto guardada en el dispositivo");
    } catch (e: any) {
      toast.error("No se pudo guardar la foto: " + (e?.message ?? e));
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <Button variant="outline" className="h-11 gap-1.5" disabled={busy} onClick={() => ref.current?.click()}>
        <Camera className="h-4 w-4" /> Foto
      </Button>
    </>
  );
}
