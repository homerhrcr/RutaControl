import { describe, expect, test } from "bun:test";
import { tokenInicio, webhookPermitido, telegramUpdateSchema, textoDocumento } from "./telegram";

describe("Telegram clientes", () => {
  test("acepta solo códigos de vinculación con formato válido", () => {
    const token = "a".repeat(48);
    expect(tokenInicio(`/start ${token}`)).toBe(token);
    expect(tokenInicio("/start cliente-123")).toBeNull();
    expect(tokenInicio(`mensaje /start ${token}`)).toBeNull();
  });
  test("no reemplaza el receptor de otra aplicación", () => {
    const destino = "https://ruta.example/api/public/telegram/webhook";
    expect(webhookPermitido("", destino)).toBe(true);
    expect(webhookPermitido(destino, destino)).toBe(true);
    expect(webhookPermitido("https://impulso.example/api/public/telegram/webhook", destino)).toBe(false);
  });
  test("valida identificadores y tamaño de mensajes entrantes", () => {
    const update = { update_id: 123, message: { message_id: 1, chat: { id: 456, type: "private" }, text: "Confirmo el pedido" } };
    expect(telegramUpdateSchema.safeParse(update).success).toBe(true);
    expect(telegramUpdateSchema.safeParse({ ...update, update_id: -1 }).success).toBe(false);
    expect(telegramUpdateSchema.safeParse({ ...update, message: { ...update.message, text: "x".repeat(4097) } }).success).toBe(false);
  });
  test("tiquete toma cantidades, total y forma de pago del documento", () => {
    const texto = textoDocumento({ empresa: "Lácteos La Rivera", tipo: "tiquete", id: "12345678-abcd", cliente: "Cliente prueba", fecha: "2026-10-17", metodo: "credito", total: 7000, items: [{ nombre: "Leche", cantidad: 2, total: 7000 }] });
    expect(texto).toContain("2 × Leche");
    expect(texto).toContain("7.000");
    expect(texto).toContain("Pago: Crédito");
  });
});