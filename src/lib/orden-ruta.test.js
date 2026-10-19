import { expect, test } from "bun:test";
import { moverAPosicion } from "./orden-ruta";

const clientes = Array.from({ length: 45 }, (_, i) => ({ id: String(i + 1) }));
test("escribir posición 2 mueve el cliente 45 y desplaza los demás sin perder clientes", () => {
  const result = moverAPosicion(clientes, "45", 2);
  expect(result.map((c) => c.id)).toEqual(["1", "45", ...clientes.slice(1, 44).map((c) => c.id)]);
  expect(clientes[44].id).toBe("45");
});
test("mover hacia abajo o al principio conserva el orden relativo", () => {
  expect(moverAPosicion(clientes.slice(0, 4), "1", 4).map((c) => c.id)).toEqual(["2", "3", "4", "1"]);
  expect(moverAPosicion(clientes.slice(0, 4), "4", 1).map((c) => c.id)).toEqual(["4", "1", "2", "3"]);
});
test("posiciones fuera de rango se limitan y entradas inválidas no cambian el orden", () => {
  expect(moverAPosicion(clientes, "1", 999)[44].id).toBe("1");
  expect(moverAPosicion(clientes, "45", 0)[0].id).toBe("45");
  expect(moverAPosicion(clientes, "45", NaN)).toBe(clientes);
  expect(moverAPosicion(clientes, "45", 1.5)).toBe(clientes);
  expect(moverAPosicion(clientes, "missing", 2)).toBe(clientes);
});