import catalogo from "./division-territorial-cr.json";

export type DireccionTerritorial = { provincia: string; canton: string; distrito: string };
export type Provincia = { nombre: string; cantones: { nombre: string; distritos: string[] }[] };
export const provincias: Provincia[] = catalogo;

const comparar = (valor: string) => valor.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
export function cantonesDe(provincia: string) {
  return provincias.find((p) => comparar(p.nombre) === comparar(provincia))?.cantones ?? [];
}
export function distritosDe(provincia: string, canton: string) {
  return cantonesDe(provincia).find((c) => comparar(c.nombre) === comparar(canton))?.distritos ?? [];
}
export function normalizarDireccion(direccion: DireccionTerritorial): DireccionTerritorial {
  const provincia = provincias.find((p) => comparar(p.nombre) === comparar(direccion.provincia))?.nombre ?? direccion.provincia;
  const canton = cantonesDe(provincia).find((c) => comparar(c.nombre) === comparar(direccion.canton))?.nombre ?? direccion.canton;
  const distrito = distritosDe(provincia, canton).find((d) => comparar(d) === comparar(direccion.distrito)) ?? direccion.distrito;
  return { provincia, canton, distrito };
}
export function cambiarProvincia(provincia: string): DireccionTerritorial {
  return { provincia, canton: "", distrito: "" };
}
export function cambiarCanton(direccion: DireccionTerritorial, canton: string): DireccionTerritorial {
  return { ...direccion, canton, distrito: "" };
}
export function errorDireccion(direccion: DireccionTerritorial): string | null {
  const { provincia, canton, distrito } = direccion;
  if (provincia && !provincias.some((p) => p.nombre === provincia)) return "Seleccione una provincia del catálogo";
  if (canton && !cantonesDe(provincia).some((c) => c.nombre === canton)) return "Seleccione un cantón de la provincia indicada";
  if (distrito && !distritosDe(provincia, canton).includes(distrito)) return "Seleccione un distrito del cantón indicado";
  return null;
}