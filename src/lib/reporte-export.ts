// Exporta un reporte (resumen + secciones de tabla) a PDF con membrete y a Excel con formato.
import type { EmpresaDatos } from "@/lib/empresa";
import { esNumerica, formatoValor, numFmtExcel, tieneDecimales, valorCelda, type Columna, type Fila, type TipoCol } from "@/lib/reporte-formato";
import { descargarBlob, mostrarPdf } from "@/lib/pdf-preview";

export type Indicador = { label: string; valor: number; tipo: TipoCol };
export type Seccion = { titulo: string; columnas: Columna[]; filas: Fila[]; totales?: Fila; nota?: string };
export type Reporte = { titulo: string; descripcion: string; indicadores: Indicador[]; secciones: Seccion[] };
export type Contexto = { periodo: string; ruta: string; usuario: string };

const PRIMARIO: [number, number, number] = [14, 74, 92];
const ARGB = "FF0E4A5C";

const nombreArchivo = (r: Reporte, ext: string) =>
  `${r.titulo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.${ext}`;

const decimalesCol = (s: Seccion, c: Columna) => tieneDecimales([...s.filas.map((f) => f[c.key]), s.totales?.[c.key]]);

export async function verReportePdf(r: Reporte, emp: EmpresaDatos, ctx: Contexto) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "letter", orientation: "landscape" });
  const W = doc.internal.pageSize.getWidth();
  const M = 12;

  // Encabezado institucional
  let x = M;
  if (emp.logo) {
    try {
      const p = doc.getImageProperties(emp.logo);
      const k = Math.min(45 / p.width, 20 / p.height);
      const w = p.width * k;
      doc.addImage(emp.logo, p.fileType || "PNG", M, 9, w, p.height * k);
      x = M + w + 5;
    } catch {
      /* logo inválido */
    }
  }
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold").setFontSize(14).text(emp.nombre, x, 15);
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(80);
  const lineas = [
    emp.razonSocial && emp.razonSocial !== emp.nombre ? emp.razonSocial : "",
    emp.cedula ? `Cédula: ${emp.cedula}` : "",
    [emp.telefono && `Tel. ${emp.telefono}`, emp.correo, emp.web].filter(Boolean).join("  ·  "),
    emp.direccion,
  ].filter(Boolean);
  lineas.forEach((l, i) => doc.text(l, x, 20 + i * 4));

  doc.setTextColor(...PRIMARIO).setFont("helvetica", "bold").setFontSize(13).text(r.titulo, W - M, 15, { align: "right" });
  doc.setTextColor(80).setFont("helvetica", "normal").setFontSize(8.5);
  [`Período: ${ctx.periodo}`, `Ruta: ${ctx.ruta}`, `Emitido: ${new Date().toLocaleString("es-CR")}`, ctx.usuario ? `Por: ${ctx.usuario}` : ""]
    .filter(Boolean)
    .forEach((l, i) => doc.text(l, W - M, 20 + i * 4, { align: "right" }));
  const yLinea = Math.max(32, 20 + Math.max(lineas.length, 4) * 4);
  doc.setDrawColor(...PRIMARIO).setLineWidth(0.6).line(M, yLinea, W - M, yLinea);
  let y = yLinea + 5;

  doc.setTextColor(90).setFontSize(8.5).text(doc.splitTextToSize(r.descripcion, W - 2 * M), M, y);
  y += 6;

  // Indicadores en tarjetas
  if (r.indicadores.length) {
    const porFila = Math.min(6, r.indicadores.length);
    const ancho = (W - 2 * M - (porFila - 1) * 3) / porFila;
    r.indicadores.forEach((ind, i) => {
      const cx = M + (i % porFila) * (ancho + 3);
      const cy = y + Math.floor(i / porFila) * 17;
      doc.setFillColor(240, 246, 248).setDrawColor(205, 222, 228).roundedRect(cx, cy, ancho, 14, 1.5, 1.5, "FD");
      doc.setTextColor(100).setFont("helvetica", "normal").setFontSize(7.5).text(ind.label.replace(/₡/g, "¢"), cx + 2.5, cy + 5);
      doc.setTextColor(...PRIMARIO).setFont("helvetica", "bold").setFontSize(11)
        .text(formatoValor(ind.valor, ind.tipo, ind.tipo !== "moneda" && tieneDecimales([ind.valor]), "¢"), cx + 2.5, cy + 11);
    });
    y += Math.ceil(r.indicadores.length / porFila) * 17 + 2;
  }

  for (const s of r.secciones) {
    const dec = s.columnas.map((c) => decimalesCol(s, c));
    const fmt = (f: Fila) => s.columnas.map((c, i) => formatoValor(f[c.key], c.tipo, dec[i], "¢"));
    if (y > doc.internal.pageSize.getHeight() - 35) {
      doc.addPage();
      y = 15;
    }
    doc.setTextColor(...PRIMARIO).setFont("helvetica", "bold").setFontSize(10.5).text(s.titulo, M, y + 3);
    autoTable(doc, {
      startY: y + 5,
      margin: { left: M, right: M, bottom: 16 },
      head: [s.columnas.map((c) => c.titulo.replace(/₡/g, "¢"))],
      body: s.filas.length ? s.filas.map(fmt) : [[{ content: "Sin datos para este período", colSpan: s.columnas.length, styles: { halign: "center", textColor: 120 } }]],
      foot: s.totales ? [fmt(s.totales)] : undefined,
      showFoot: "lastPage",
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 1.6, overflow: "linebreak" },
      headStyles: { fillColor: PRIMARIO, textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: [222, 234, 238], textColor: 20, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [246, 249, 250] },
      columnStyles: Object.fromEntries(s.columnas.map((c, i) => [i, { halign: esNumerica(c.tipo) ? "right" : "left" }])),
      didParseCell: (d) => {
        if ((d.section === "head" || d.section === "foot") && esNumerica(s.columnas[d.column.index]?.tipo)) d.cell.styles.halign = "right";
      },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
    if (s.nota) {
      doc.setTextColor(110).setFont("helvetica", "italic").setFontSize(7.5).text(s.nota, M, y + 2);
      y += 5;
    }
    y += 4;
  }

  // Pie de página
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    const H = doc.internal.pageSize.getHeight();
    doc.setDrawColor(210).setLineWidth(0.2).line(M, H - 10, W - M, H - 10);
    doc.setTextColor(120).setFont("helvetica", "normal").setFontSize(7.5);
    doc.text(emp.pie || `${emp.nombre} · Documento de uso interno`, M, H - 6);
    doc.text(`Página ${i} de ${n}`, W - M, H - 6, { align: "right" });
  }

  mostrarPdf(doc.output("blob"), nombreArchivo(r, "pdf"), r.titulo);
}

export async function descargarReporteExcel(r: Reporte, emp: EmpresaDatos, ctx: Contexto) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = emp.nombre;
  wb.created = new Date();
  const logoId = emp.logo
    ? wb.addImage({ base64: emp.logo, extension: emp.logo.startsWith("data:image/jpeg") ? "jpeg" : "png" })
    : null;

  const encabezado = (ws: any, ncols: number, subtitulo: string) => {
    const cols = Math.max(ncols, 4);
    const filas: [string, any][] = [
      [emp.nombre, { bold: true, size: 15, color: { argb: ARGB } }],
      [[emp.razonSocial !== emp.nombre ? emp.razonSocial : "", emp.cedula && `Cédula ${emp.cedula}`].filter(Boolean).join(" · "), { size: 9, color: { argb: "FF555555" } }],
      [[emp.telefono && `Tel. ${emp.telefono}`, emp.correo, emp.direccion].filter(Boolean).join(" · "), { size: 9, color: { argb: "FF555555" } }],
      [subtitulo, { bold: true, size: 12 }],
      [`Período: ${ctx.periodo} · Ruta: ${ctx.ruta} · Emitido: ${new Date().toLocaleString("es-CR")}`, { size: 9, italic: true, color: { argb: "FF555555" } }],
    ];
    filas.forEach(([t, font], i) => {
      ws.mergeCells(i + 1, 1, i + 1, cols - (logoId != null && i < 3 ? 1 : 0));
      const c = ws.getCell(i + 1, 1);
      c.value = t;
      c.font = font;
    });
    if (logoId != null) ws.addImage(logoId, { tl: { col: cols - 1, row: 0 }, ext: { width: 110, height: 55 }, editAs: "oneCell" });
    ws.addRow([]);
  };
  const pagina = (titulo: string) => ({
    pageSetup: { paperSize: 1, orientation: "landscape" as const, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 } },
    headerFooter: { oddFooter: `&L${(emp.pie || emp.nombre).replace(/&/g, "&&")}&RPágina &P de &N`, oddHeader: `&R${titulo.replace(/&/g, "&&")}` },
  });

  // Hoja resumen con indicadores
  const res = wb.addWorksheet("Resumen", pagina(r.titulo));
  res.columns = [{ width: 38 }, { width: 22 }, { width: 14 }, { width: 18 }];
  encabezado(res, 4, r.titulo);
  res.addRow([r.descripcion]).getCell(1).font = { italic: true, size: 9 };
  res.mergeCells(res.rowCount, 1, res.rowCount, 4);
  res.addRow([]);
  const hr = res.addRow(["Indicador", "Valor"]);
  hr.eachCell((c: any) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ARGB } };
  });
  for (const ind of r.indicadores) {
    const row = res.addRow([ind.label, valorCelda(ind.valor, ind.tipo)]);
    row.getCell(2).numFmt = numFmtExcel(ind.tipo, ind.tipo !== "moneda" && tieneDecimales([ind.valor]))!;
    row.getCell(2).font = { bold: true };
    row.eachCell((c: any) => (c.border = { bottom: { style: "hair", color: { argb: "FFDDDDDD" } } }));
  }

  const usados = new Set<string>(["Resumen"]);
  for (const s of r.secciones) {
    let nombre = s.titulo.replace(/[\\/*?:[\]]/g, "").slice(0, 31);
    for (let k = 2; usados.has(nombre); k++) nombre = `${nombre.slice(0, 28)} ${k}`;
    usados.add(nombre);
    const ws = wb.addWorksheet(nombre, pagina(r.titulo));
    ws.columns = s.columnas.map((c) => ({ width: c.tipo === "texto" ? Math.max(14, Math.min(40, c.titulo.length + 18)) : Math.max(13, c.titulo.length + 3) }));
    encabezado(ws, s.columnas.length, `${r.titulo} — ${s.titulo}`);
    const dec = s.columnas.map((c) => decimalesCol(s, c));
    const h = ws.addRow(s.columnas.map((c) => c.titulo));
    const filaHead = h.number;
    h.eachCell((c: any, i: number) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ARGB } };
      c.alignment = { horizontal: esNumerica(s.columnas[i - 1].tipo) ? "right" : "left", vertical: "middle", wrapText: true };
    });
    const aplicar = (row: any, bold = false) =>
      s.columnas.forEach((c, i) => {
        const cell = row.getCell(i + 1);
        const f = numFmtExcel(c.tipo, dec[i]);
        if (f) cell.numFmt = f;
        if (esNumerica(c.tipo)) cell.alignment = { horizontal: "right" };
        cell.border = { bottom: { style: "hair", color: { argb: "FFE5E5E5" } } };
        if (bold) {
          cell.font = { bold: true };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDEEAEE" } };
        }
      });
    s.filas.forEach((f, idx) => {
      const row = ws.addRow(s.columnas.map((c) => valorCelda(f[c.key], c.tipo)));
      aplicar(row);
      if (idx % 2 === 1) row.eachCell((c: any) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF6F9FA" } }));
    });
    if (s.filas.length) ws.autoFilter = { from: { row: filaHead, column: 1 }, to: { row: filaHead + s.filas.length, column: s.columnas.length } };
    if (s.totales) aplicar(ws.addRow(s.columnas.map((c) => valorCelda(s.totales![c.key], c.tipo))), true);
    if (s.nota) ws.addRow([s.nota]).getCell(1).font = { italic: true, size: 9, color: { argb: "FF666666" } };
    ws.views = [{ state: "frozen", ySplit: filaHead }];
  }

  const buf = await wb.xlsx.writeBuffer();
  descargarBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), nombreArchivo(r, "xlsx"));
}
