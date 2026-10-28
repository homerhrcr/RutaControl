import { expect, test } from "bun:test";
import { ordenarSegunCatalogo } from "./orden-productos";

const catalogo = [
  { id: "agria", nombre: "Leche Agria" },
  { id: "raton", nombre: "Queso Ratón" },
  { id: "agria-litro", nombre: "Leche Agria litro" },
  { id: "fresca", nombre: "Leche Fresca" },
];

test("venta en ruta respeta las posiciones 1 y 3 de leche agria sin priorizar antiguos favoritos", () => {
  const filas = [catalogo[3], catalogo[1], catalogo[2], catalogo[0]];
  expect(ordenarSegunCatalogo(filas, catalogo, (p) => p.id).map((p) => p.id))
    .toEqual(["agria", "raton", "agria-litro", "fresca"]);
  expect(ordenarSegunCatalogo(filas.filter((p) => p.nombre.includes("Leche")), catalogo, (p) => p.id).map((p) => p.id))
    .toEqual(["agria", "agria-litro", "fresca"]);
});

test("carga respeta el orden manual aunque la preventa y el orden de inserción sean diferentes", () => {
  const filas = [
    { producto_id: "fresca", preventa: 50 },
    { producto_id: "agria-litro", preventa: 10 },
    { producto_id: "raton", preventa: 20 },
    { producto_id: "agria", preventa: 0 },
  ];
  expect(ordenarSegunCatalogo(filas, catalogo, (p) => p.producto_id).map((p) => p.producto_id))
    .toEqual(["agria", "raton", "agria-litro", "fresca"]);
  expect(filas[0].producto_id).toBe("fresca");
});

test("productos históricos fuera del catálogo se conservan al final sin cambiar cantidades", () => {
  const filas = [{ id: "inactivo", cantidad: 7 }, { id: "fresca", cantidad: 2 }, { id: "agria", cantidad: 3 }];
  expect(ordenarSegunCatalogo(filas, catalogo, (p) => p.id)).toEqual([filas[2], filas[1], filas[0]]);
  expect(ordenarSegunCatalogo(filas, [], (p) => p.id)).toEqual(filas);
});