import { expect, test } from "bun:test";
import { estimarCarga } from "./carga-estimacion";

test("estima salida con cantidades completas, costos y precios de venta de ruta", () => {
  const r = estimarCarga([{ producto_id: "leche", preventa: 2, extra: 10 }], [{ id: "leche", costo: 630 }], [{ id: "leche", precio: 1300, precioInfo: { valido: true } }]);
  expect(r.filas[0].venta).toBe(1300);
  expect(r.costoTotal).toBe(7560);
  expect(r.ventaTotal).toBe(15600);
  expect(r.utilidad).toBe(8040);
});
test("precio faltante no se convierte en cero ni en utilidad negativa ficticia", () => {
  const r = estimarCarga([{ producto_id: "leche", preventa: 0, extra: 12 }], [{ id: "leche", costo: 630 }], [{ id: "leche", precio: 0, precioInfo: { valido: false } }]);
  expect(r.filas[0].venta).toBeNull();
  expect(r.ventaTotal).toBeNull();
  expect(r.utilidad).toBeNull();
  expect(r.faltantes).toEqual(["leche"]);
});
test("precio válido de cero se distingue de un precio sin configurar", () => {
  expect(estimarCarga([{ producto_id: "p", preventa: 1, extra: 0 }], [{ id: "p", costo: 10 }], [{ id: "p", precio: 0, precioInfo: { valido: true } }]).utilidad).toBe(-10);
});