import { describe, expect, it } from "vitest";
import { numFmtExcel, formatoValor, valorCelda, tieneDecimales } from "./reporte-formato";

describe("formato de reportes", () => {
  it("moneda sin decimales en Excel", () => expect(numFmtExcel("moneda", false)).toBe('"₡"#,##0'));
  it("moneda con céntimos usa solo dos decimales", () => expect(numFmtExcel("moneda", true)).toBe('"₡"#,##0.00'));
  it("números enteros sin decimales", () => expect(numFmtExcel("entero", true)).toBe("#,##0"));
  it("redondea a dos decimales", () => expect(valorCelda(10.456, "moneda")).toBe(10.46));
  it("entero redondea", () => expect(valorCelda(3.6, "entero")).toBe(4));
  it("detecta céntimos", () => {
    expect(tieneDecimales([100, 200])).toBe(false);
    expect(tieneDecimales([100, 200.5])).toBe(true);
  });
  it("texto de moneda", () => expect(formatoValor(1234567, "moneda", false, "¢")).toBe("¢1,234,567"));
  it("porcentaje con dos decimales", () => expect(formatoValor(0.12345, "pct")).toBe("12.35%"));
});
