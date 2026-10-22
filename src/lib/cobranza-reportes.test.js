import { expect, test } from "bun:test";
import { atribuirCobranza, incluirCobranza } from "./cobranza-reportes";
import { carteraCobranza, resumenEjecutivo } from "./reportes-gerenciales";

const rutas = new Map([["mie", "Ruta Miércoles"], ["jue", "Ruta Jueves"], ["sab", "Ruta Sábado"]]);
const clientes = new Map([["compartido", ["Ruta Jueves", "Ruta Sábado"]]]);

test("abono global de miércoles se incluye sin cliente y deja saldo 156100", () => {
  const atribucion = atribuirCobranza({ ruta_id: "mie" }, null, rutas, clientes);
  expect(incluirCobranza("Ruta Miércoles", atribucion)).toBe(true);
  expect(incluirCobranza("Ruta Jueves", atribucion)).toBe(false);
  const datos = { ventas: [], detalles: [], gastos: [], devoluciones: [], clientes: [], productos: [],
    hoy: new Date("2026-10-22T12:00:00Z"), abonos: [{ fecha: "2026-10-22", monto: 459000 }],
    creditos: [{ cliente: "Ruta Miércoles (Cierre global)", ruta: atribucion.ruta, fecha: "2026-10-22", saldo: 615100 - 459000 }] };
  expect(resumenEjecutivo(datos).indicadores[3].valor).toBe(459000);
  expect(carteraCobranza(datos).indicadores[0].valor).toBe(156100);
  expect(carteraCobranza(datos).indicadores[2].valor).toBe(459000);
});

for (const [id, nombre] of rutas) {
  test(`cobros de ${nombre} usan la venta original aunque cliente pertenezca a varias rutas`, () => {
    const a = atribuirCobranza({ ventas: { ruta_id: id } }, "compartido", rutas, clientes);
    expect(a.ruta).toBe(nombre);
    for (const otra of rutas.values()) expect(incluirCobranza(otra, a)).toBe(otra === nombre);
  });
}

test("ruta explícita del crédito prevalece sobre venta y afiliación del cliente", () => {
  expect(atribuirCobranza({ ruta_id: "mie", ventas: { ruta_id: "jue" } }, "compartido", rutas, clientes).ruta).toBe("Ruta Miércoles");
});

test("créditos antiguos sin ruta conservan filtro por afiliación y cobros sin ruta siguen en total", () => {
  const legado = atribuirCobranza(null, "compartido", rutas, clientes);
  expect(incluirCobranza("Ruta Sábado", legado)).toBe(true);
  expect(incluirCobranza("Ruta Miércoles", legado)).toBe(false);
  expect(incluirCobranza("all", atribuirCobranza(null, null, rutas, clientes))).toBe(true);
});