import { expect, test } from "bun:test";
import { opcionesSelector, predeterminada, validarEtiqueta, mover } from "./catalogos-logica";

const ops = [
  { id: "a", codigo: "Vencido", etiqueta: "Vencido", activo: true, orden: 2 },
  { id: "b", codigo: "Mal estado", etiqueta: "Mal estado", activo: true, orden: 1, predeterminado: true },
  { id: "c", codigo: "Otro", etiqueta: "Otro", activo: false, orden: 3 },
];

test("las opciones inactivas no se ofrecen para registros nuevos", () => {
  expect(opcionesSelector(ops).map((o) => o.value)).toEqual(["Mal estado", "Vencido"]);
});
test("un registro guardado con una opción inactiva la sigue mostrando", () => {
  const r = opcionesSelector(ops, "Otro");
  expect(r.at(-1)).toEqual({ value: "Otro", label: "Otro (inactiva)", inactiva: true });
});
test("se usa la opción predeterminada activa", () => {
  expect(predeterminada(ops)).toBe("Mal estado");
  expect(predeterminada([{ ...ops[1], activo: false }, ops[0]])).toBe("Vencido");
});
test("no permite duplicados aunque cambien mayúsculas o tildes", () => {
  expect(validarEtiqueta(ops, "  mal ESTADO ")).toBe("Ya existe una opción con ese nombre");
  expect(validarEtiqueta(ops, "Mal estado", "b")).toBeNull();
  expect(validarEtiqueta(ops, "")).toBe("Escriba un nombre");
});
test("mover reordena de forma secuencial", () => {
  expect(mover(ops, "a", -1)).toEqual([{ id: "a", orden: 1 }, { id: "b", orden: 2 }, { id: "c", orden: 3 }]);
});
