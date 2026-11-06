import { test, expect } from "bun:test";
import { distribuirAbono } from "./abono-distribucion";

test("el abono se aplica primero a la deuda más antigua", () => {
  const r = distribuirAbono([{ id: "a", saldo: 3000 }, { id: "b", saldo: 5000 }], 4000);
  expect(r.partes.map((p) => [p.credito.id, p.monto])).toEqual([["a", 3000], ["b", 1000]]);
  expect(r.aplicado).toBe(4000);
});

test("un abono mayor a la deuda no se aplica de más", () => {
  const r = distribuirAbono([{ id: "a", saldo: 2000 }], 5000);
  expect(r.aplicado).toBe(2000);
  expect(r.sobrante).toBe(3000);
});
