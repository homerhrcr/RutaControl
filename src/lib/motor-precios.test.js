import { expect, test } from "bun:test";
import { resolverPrecio } from "./precios";

const queso = { id: "queso", precio: 4000 };
const rutas = [{ id: "jue", lista_precio_id: "L-jue" }, { id: "sab", lista_precio_id: "L-sab" }];
const listas = [{ id: "L-jue", nombre: "Ruta jueves", activo: true }, { id: "L-sab", nombre: "Ruta sábado", activo: true }];
const precios = [{ lista_id: "L-jue", producto_id: "queso", precio: 3800 }, { lista_id: "L-sab", producto_id: "queso", precio: 3600 }];
const base = { producto: queso, clienteId: "c1", rutas, listas, precios, fecha: "2026-10-22" };
const esp = (o) => ({ id: Math.random().toString(), cliente_id: "c1", producto_id: "queso", ruta_id: null, precio: 0, fecha_inicio: "2026-01-01", fecha_fin: null, activo: true, ...o });

test("1: Ruta jueves usa su lista", () => {
  const r = resolverPrecio({ ...base, rutaId: "jue" });
  expect(r.precio).toBe(3800); expect(r.fuente).toBe("lista_ruta");
});
test("2: el mismo cliente en Ruta sábado usa la lista del sábado", () => {
  expect(resolverPrecio({ ...base, rutaId: "sab" }).precio).toBe(3600);
});
test("3: especial de Ruta jueves no se aplica el sábado", () => {
  const especiales = [esp({ ruta_id: "jue", precio: 3500 })];
  expect(resolverPrecio({ ...base, rutaId: "jue", especiales }).precio).toBe(3500);
  expect(resolverPrecio({ ...base, rutaId: "sab", especiales }).precio).toBe(3600);
});
test("4: especial de ruta gana al general; en otras rutas rige el general", () => {
  const especiales = [esp({ ruta_id: "jue", precio: 3500 }), esp({ precio: 3550 })];
  expect(resolverPrecio({ ...base, rutaId: "jue", especiales }).fuente).toBe("especial_ruta");
  const s = resolverPrecio({ ...base, rutaId: "sab", especiales });
  expect(s.precio).toBe(3550); expect(s.fuente).toBe("especial_general");
});
test("5: sin precio en la lista de la ruta se bloquea aunque exista precio general", () => {
  const r = resolverPrecio({ ...base, producto: { id: "leche", precio: 1200 }, rutaId: "jue" });
  expect(r.precio).toBe(0); expect(r.valido).toBe(false); expect(r.fuente).toBe("sin_precio");
});
test("6: sin ningún precio válido no es vendible", () => {
  const r = resolverPrecio({ ...base, producto: { id: "leche", precio: 0 }, rutaId: "jue" });
  expect(r.valido).toBe(false); expect(r.fuente).toBe("sin_precio");
});
test("7: especial vencido o inactivo se ignora", () => {
  const especiales = [esp({ ruta_id: "jue", precio: 3500, fecha_fin: "2026-10-01" }), esp({ precio: 3000, activo: false })];
  expect(resolverPrecio({ ...base, rutaId: "jue", especiales }).precio).toBe(3800);
});
test("lista inactiva o fuera de vigencia no se usa", () => {
  const ls = [{ ...listas[0], activo: false }, listas[1]];
  expect(resolverPrecio({ ...base, listas: ls, rutaId: "jue" }).valido).toBe(false);
  const lv = [{ ...listas[0], fecha_fin: "2026-10-01" }, listas[1]];
  expect(resolverPrecio({ ...base, listas: lv, rutaId: "jue" }).valido).toBe(false);
});
test("vigencia por fecha: cambia de precio el 1 de noviembre", () => {
  const especiales = [esp({ ruta_id: "jue", precio: 3800, fecha_fin: "2026-10-31" }), esp({ ruta_id: "jue", precio: 4000, fecha_inicio: "2026-11-01" })];
  expect(resolverPrecio({ ...base, rutaId: "jue", especiales, fecha: "2026-10-31" }).precio).toBe(3800);
  expect(resolverPrecio({ ...base, rutaId: "jue", especiales, fecha: "2026-11-01" }).precio).toBe(4000);
});
test("conflicto: dos especiales vigentes del mismo alcance no se eligen", () => {
  const especiales = [esp({ ruta_id: "jue", precio: 3500 }), esp({ ruta_id: "jue", precio: 3400 })];
  const r = resolverPrecio({ ...base, rutaId: "jue", especiales });
  expect(r.valido).toBe(false); expect(r.fuente).toBe("conflicto");
});
test("8: cambiar la ruta recalcula el precio", () => {
  expect(resolverPrecio({ ...base, rutaId: "jue" }).precio).not.toBe(resolverPrecio({ ...base, rutaId: "sab" }).precio);
});
test("ruta sin lista no toma la lista del cliente ni el precio general", () => {
  const r = resolverPrecio({ ...base, rutaId: "otra", listaClienteId: "L-sab" });
  expect(r.precio).toBe(0); expect(r.valido).toBe(false); expect(r.fuente).toBe("sin_precio");
});
test("modificar una lista no cambia los precios de otra ruta", () => {
  const modificados = precios.map((p) => p.lista_id === "L-jue" ? { ...p, precio: 5000 } : p);
  expect(resolverPrecio({ ...base, precios: modificados, rutaId: "jue" }).precio).toBe(5000);
  expect(resolverPrecio({ ...base, precios: modificados, rutaId: "sab" }).precio).toBe(3600);
});
test("modificar el precio general no cambia el precio de ninguna ruta", () => {
  const producto = { ...queso, precio: 9900 };
  expect(resolverPrecio({ ...base, producto, rutaId: "jue" }).precio).toBe(3800);
  expect(resolverPrecio({ ...base, producto, rutaId: "sab" }).precio).toBe(3600);
});
test("lista futura bloquea hasta el inicio y vence para toda la lista", () => {
  const ls = [{ ...listas[0], fecha_inicio: "2026-11-01", fecha_fin: "2026-11-30" }, listas[1]];
  expect(resolverPrecio({ ...base, listas: ls, rutaId: "jue", fecha: "2026-10-31" }).valido).toBe(false);
  expect(resolverPrecio({ ...base, listas: ls, rutaId: "jue", fecha: "2026-11-01" }).precio).toBe(3800);
  expect(resolverPrecio({ ...base, listas: ls, rutaId: "jue", fecha: "2026-12-01" }).valido).toBe(false);
});
