// Formatos de columnas de reportes, compartidos por pantalla, PDF y Excel.
export type TipoCol = "texto" | "moneda" | "entero" | "decimal" | "pct" | "fecha";
export type Columna = { key: string; titulo: string; tipo: TipoCol };
export type Fila = Record<string, string | number | null | undefined>;

/** true si algún valor numérico tiene céntimos (a 2 decimales). */
export function tieneDecimales(vals: unknown[]): boolean {
  return vals.some((v) => typeof v === "number" && Math.abs(Math.round(v * 100) - Math.round(v) * 100) >= 1);
}

/** Formato numérico de Excel: moneda y enteros sin decimales; si hacen falta, solo dos. */
export function numFmtExcel(tipo: TipoCol, conDecimales: boolean): string | undefined {
  switch (tipo) {
    case "moneda":
      return conDecimales ? '"₡"#,##0.00' : '"₡"#,##0';
    case "entero":
      return "#,##0";
    case "decimal":
      return conDecimales ? "#,##0.00" : "#,##0";
    case "pct":
      return "0.00%";
    case "fecha":
      return "dd/mm/yyyy";
    default:
      return undefined;
  }
}

/** Valor numérico ya redondeado como se guardará en la celda. */
export function valorCelda(v: unknown, tipo: TipoCol): unknown {
  if (v == null || v === "") return v ?? "";
  if (tipo === "fecha") return new Date(String(v));
  if (typeof v !== "number") return v;
  if (tipo === "entero") return Math.round(v);
  if (tipo === "pct") return Math.round(v * 10000) / 10000;
  return Math.round(v * 100) / 100;
}

function miles(n: number, dec: number) {
  const [ent, frac] = Math.abs(n).toFixed(dec).split(".");
  const conMiles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (n < 0 ? "-" : "") + conMiles + (frac ? "." + frac : "");
}

/** Texto para pantalla/PDF. `simbolo` permite usar ¢ en fuentes PDF sin ₡. */
export function formatoValor(v: unknown, tipo: TipoCol, conDecimales = false, simbolo = "₡"): string {
  if (v == null || v === "") return "";
  if (tipo === "fecha") {
    const d = new Date(String(v));
    return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("es-CR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  if (typeof v !== "number") return String(v);
  switch (tipo) {
    case "moneda":
      return simbolo + miles(v, conDecimales ? 2 : 0);
    case "entero":
      return miles(Math.round(v), 0);
    case "decimal":
      return miles(v, conDecimales ? 2 : 0);
    case "pct":
      return miles(v * 100, 2) + "%";
    default:
      return String(v);
  }
}

export const esNumerica = (t: TipoCol) => t === "moneda" || t === "entero" || t === "decimal" || t === "pct";
