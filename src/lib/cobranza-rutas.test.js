import { expect, test } from "bun:test";
import { creditosDeRuta, limitarCreditos, rutaDeCredito, resumirCreditoPorRuta } from "./cobranza-rutas";

test("cada ruta muestra solo sus saldos aunque el cliente compre en ambas", () => {
  const cliente = { ruta_id: "jueves", cliente_rutas: [{ ruta_id: "jueves" }, { ruta_id: "sabado" }] };
  const creditos = [
    { id: "a", ventas: { ruta_id: "jueves" }, clientes: cliente, saldo: 10000 },
    { id: "b", ventas: { ruta_id: "sabado" }, clientes: cliente, saldo: 25000 },
    { id: "c", ruta_id: "miercoles", saldo: 156100 },
  ];
  expect(creditosDeRuta(creditos, "jueves").reduce((s, c) => s + c.saldo, 0)).toBe(10000);
  expect(creditosDeRuta(creditos, "sabado").map((c) => c.id)).toEqual(["b"]);
  expect(creditosDeRuta(creditos, "miercoles").map((c) => c.id)).toEqual(["c"]);
});

test("el crédito global conserva su ruta por encima de la venta o del cliente", () => {
  expect(rutaDeCredito({ id: "global", ruta_id: "miercoles", ventas: { ruta_id: "jueves" }, clientes: { ruta_id: "sabado" } })).toBe("miercoles");
});

test("deudas antiguas ambiguas no se duplican en varias rutas", () => {
  expect(rutaDeCredito({ id: "viejo", clientes: { cliente_rutas: [{ ruta_id: "jueves" }, { ruta_id: "sabado" }] } })).toBe("sin-ruta");
  expect(rutaDeCredito({ id: "unico", clientes: { cliente_rutas: [{ ruta_id: "jueves" }] } })).toBe("jueves");
});

test("abonar o pagar todo solo puede seleccionar créditos de la ruta abierta", () => {
  const creditos = [{ id: "jueves", saldo: 10000 }, { id: "sabado", saldo: 25000 }];
  expect(limitarCreditos(creditos, ["jueves"])).toEqual([{ id: "jueves", saldo: 10000 }]);
  expect(limitarCreditos(creditos, [])).toEqual([]);
  expect(limitarCreditos(creditos)).toEqual(creditos);
});

test("fichas del dashboard suman crédito global y de clientes sin duplicar ni contar pagados", () => {
  const resumen = resumirCreditoPorRuta([
    { id: "global", ruta_id: "miercoles", saldo: 156100 },
    { id: "cliente", ventas: { ruta_id: "jueves" }, clientes: { ruta_id: "sabado" }, saldo: 124000 },
    { id: "pagado", ruta_id: "sabado", saldo: 0 },
    { id: "legado", saldo: 5000 },
  ], [{ id: "miercoles", nombre: "Ruta Miércoles" }, { id: "jueves", nombre: "Ruta Jueves" }, { id: "sabado", nombre: "Ruta Sábado" }]);
  expect(resumen.map((r) => [r.id, r.saldo, r.creditos])).toEqual([
    ["miercoles", 156100, 1], ["jueves", 124000, 1], ["sabado", 0, 0], ["sin-ruta", 5000, 1],
  ]);
  expect(resumen.reduce((s, r) => s + r.saldo, 0)).toBe(285100);
});