import { test, expect } from "bun:test";
import { parsearSolicitud } from "./solicitudes-devolucion";

test("lee productos, cantidades, motivos y nota de la solicitud de Telegram", () => {
  const r = parsearSolicitud("↩️ Solicitud de devolución registrada:\n• 1 × Chuleta de Cerdo 1 Kilo (Vencimiento)\n• 2 × Leche Agria 2.5 Litros (Empaque dañado)\n📝 Agrios\n\nRecuerde: ...");
  expect(r.items).toEqual([
    { cantidad: 1, nombre: "Chuleta de Cerdo 1 Kilo", motivo: "Vencimiento" },
    { cantidad: 2, nombre: "Leche Agria 2.5 Litros", motivo: "Empaque dañado" },
  ]);
  expect(r.notas).toBe("Agrios");
});
