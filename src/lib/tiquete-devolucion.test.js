import { describe, expect, test } from "bun:test";
import { textoDevolucion } from "./tiquete-devolucion";
import { formatCRC } from "./format";

describe("Comprobante de devolución recibida", () => {
  test("conserva cantidades, valores y el rebajo real de deuda, sin asumir que todo se abonó", () => {
    const d = { id: "12345678-abcd", fecha: "2026-10-20T01:00:00Z", cliente_id: "cliente", tipo: "cliente", total: 7000, aplicado_credito: 2000, clientes: { nombre: "Cliente" }, rutas: { nombre: "Jueves" }, devoluciones_detalle: [{ nombre_producto: "Leche", cantidad: 2, precio_unitario: 3500, motivo: "Vencido", destino: "merma" }] };
    const texto = textoDevolucion(d, "Empresa");
    expect(texto).toContain("2 x Leche");
    expect(texto).toContain(formatCRC(7000));
    expect(texto).toContain(`Rebajado de deuda: ${formatCRC(2000)}`);
  });
});