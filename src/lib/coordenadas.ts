export function coordenadasValidas(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function leerCoordenadas(latitud: string, longitud: string) {
  if (!latitud.trim() && !longitud.trim()) return null;
  const lat = Number(latitud.trim().replace(",", "."));
  const lng = Number(longitud.trim().replace(",", "."));
  if (!latitud.trim() || !longitud.trim() || !coordenadasValidas(lat, lng)) {
    throw new Error("Ingrese latitud (-90 a 90) y longitud (-180 a 180) válidas.");
  }
  return { lat, lng };
}

export function pegarCoordenadas(texto: string) {
  const partes = texto.trim().split(/[,;\s]+/);
  if (partes.length !== 2) throw new Error("Pegue las coordenadas en formato latitud, longitud.");
  const pos = leerCoordenadas(partes[0], partes[1]);
  if (!pos) throw new Error("No hay coordenadas para pegar.");
  return pos;
}