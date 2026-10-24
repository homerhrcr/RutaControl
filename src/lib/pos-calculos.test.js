import { expect, test } from "bun:test";
import { receptorVacio, totalPOS, vueltoPOS, validarReceptorPOS } from "./pos-calculos";
test("cobro y vuelto se calculan sin alterar la venta", () => { const total = totalPOS([{precio:2500,cantidad:2},{precio:750,cantidad:1}]); expect(total).toBe(5750); expect(vueltoPOS(total,10000)).toBe(4250); });
test("no se acepta efectivo insuficiente", () => { expect(() => vueltoPOS(5750,5000)).toThrow(); });
test("consumidor final no necesita datos personales", () => { expect(validarReceptorPOS("interno",receptorVacio)).toBeNull(); });
test("comprobante con nombre requiere nombre", () => { expect(validarReceptorPOS("nombre",receptorVacio)).not.toBeNull(); expect(validarReceptorPOS("nombre",{...receptorVacio,nombre:"Ana"})).toBeNull(); });
test("correo inválido se rechaza", () => { expect(validarReceptorPOS("nombre",{...receptorVacio,nombre:"Ana",correo:"mal"})).not.toBeNull(); });
test("sin conexión fiscal no se declara factura emitida", () => { expect(validarReceptorPOS("electronica",{...receptorVacio,nombre:"Ana"})).not.toBeNull(); });
test("cantidades fraccionadas conservan dos decimales en total y vuelto", () => { expect(totalPOS([{precio:23.45,cantidad:0.3}])).toBe(7.04); expect(vueltoPOS(7.04,10)).toBe(2.96); });