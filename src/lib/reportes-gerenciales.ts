// Construye los reportes gerenciales a partir de los datos ya filtrados por período y ruta.
import type { Reporte } from "@/lib/reporte-export";
import type { Fila } from "@/lib/reporte-formato";

export type DatosReportes = {
  ventas: { fecha: string; total: number; metodo: string; clienteId: string | null; cliente: string; ruta: string }[];
  detalles: { productoId: string | null; producto: string; categoria: string; cantidad: number; total: number; costo: number; ruta: string; fecha?: string }[];
  gastos: { fecha: string; monto: number; categoria: string; descripcion: string; ruta: string }[];
  abonos: { fecha: string; monto: number }[];
  creditos: { cliente: string; ruta: string; saldo: number; fecha: string }[];
  devoluciones: { fecha: string; total: number; cliente: string; ruta: string; lineas: { producto: string; cantidad: number; monto: number; motivo: string; destino: string }[] }[];
  clientes: { id: string; nombre: string; ruta: string; ultimaCompra: string | null; compras90: number; total90: number }[];
  productos: { id: string; nombre: string; categoria: string; existencia: number; costo: number }[];
  hoy: Date;
};

const suma = <T>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + (f(x) || 0), 0);
const div = (a: number, b: number) => (b ? a / b : 0);
const agrupar = <T>(a: T[], k: (x: T) => string) => {
  const m = new Map<string, T[]>();
  for (const x of a) {
    const key = k(x);
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(x);
  }
  return m;
};
const dias = (desde: string, hoy: Date) => Math.max(0, Math.floor((hoy.getTime() - new Date(desde).getTime()) / 86_400_000));
const MOTIVOS: Record<string, string> = { vencido: "Vencido", danado: "Dañado", dañado: "Dañado", rechazo: "Rechazo del cliente", error: "Error de pedido", otro: "Otro" };
const DESTINOS: Record<string, string> = { merma: "Merma", reingreso: "Reingreso" };

export function resumenEjecutivo(d: DatosReportes): Reporte {
  const total = suma(d.ventas, (v) => v.total);
  const contado = suma(d.ventas.filter((v) => v.metodo === "contado"), (v) => v.total);
  const costo = suma(d.detalles, (x) => x.costo);
  const gastos = suma(d.gastos, (g) => g.monto);
  const devol = suma(d.devoluciones, (x) => x.total);
  const porDia = [...agrupar(d.ventas, (v) => v.fecha.slice(0, 10))].sort(([a], [b]) => a.localeCompare(b)).map(([dia, vs]): Fila => ({
    dia: dia + "T12:00:00",
    n: vs.length,
    contado: suma(vs.filter((v) => v.metodo === "contado"), (v) => v.total),
    credito: suma(vs.filter((v) => v.metodo !== "contado"), (v) => v.total),
    total: suma(vs, (v) => v.total),
  }));
  return {
    titulo: "Resumen ejecutivo",
    descripcion: "Visión general del negocio en el período: ventas, cobros, gastos, devoluciones y utilidad.",
    indicadores: [
      { label: "Ventas totales", valor: total, tipo: "moneda" },
      { label: "Contado", valor: contado, tipo: "moneda" },
      { label: "Crédito", valor: total - contado, tipo: "moneda" },
      { label: "Cobrado (abonos)", valor: suma(d.abonos, (a) => a.monto), tipo: "moneda" },
      { label: "Gastos", valor: gastos, tipo: "moneda" },
      { label: "Devoluciones", valor: devol, tipo: "moneda" },
      { label: "Utilidad bruta", valor: total - costo, tipo: "moneda" },
      { label: "Utilidad neta", valor: total - costo - gastos - devol, tipo: "moneda" },
      { label: "Margen neto", valor: div(total - costo - gastos - devol, total), tipo: "pct" },
      { label: "Ticket promedio", valor: div(total, d.ventas.length), tipo: "moneda" },
      { label: "Ventas realizadas", valor: d.ventas.length, tipo: "entero" },
      { label: "Clientes atendidos", valor: new Set(d.ventas.map((v) => v.clienteId)).size, tipo: "entero" },
    ],
    secciones: [
      {
        titulo: "Ventas por día",
        columnas: [
          { key: "dia", titulo: "Fecha", tipo: "fecha" },
          { key: "n", titulo: "Ventas", tipo: "entero" },
          { key: "contado", titulo: "Contado", tipo: "moneda" },
          { key: "credito", titulo: "Crédito", tipo: "moneda" },
          { key: "total", titulo: "Total", tipo: "moneda" },
        ],
        filas: porDia,
        totales: { dia: "TOTAL", n: d.ventas.length, contado, credito: total - contado, total },
      },
    ],
  };
}

export function rentabilidadRutas(d: DatosReportes): Reporte {
  const rutas = new Set([...d.ventas.map((v) => v.ruta), ...d.gastos.map((g) => g.ruta), ...d.devoluciones.map((x) => x.ruta)]);
  const filas: Fila[] = [...rutas].map((ruta) => {
    const vs = d.ventas.filter((v) => v.ruta === ruta);
    const ventas = suma(vs, (v) => v.total);
    const costo = suma(d.detalles.filter((x) => x.ruta === ruta), (x) => x.costo);
    const gastos = suma(d.gastos.filter((g) => g.ruta === ruta), (g) => g.monto);
    const devol = suma(d.devoluciones.filter((x) => x.ruta === ruta), (x) => x.total);
    const neta = ventas - costo - gastos - devol;
    return {
      ruta, n: vs.length, clientes: new Set(vs.map((v) => v.clienteId)).size, ventas, costo, bruta: ventas - costo, gastos, devol, neta,
      margen: div(neta, ventas), costoMil: div(gastos, ventas) * 1000, ticket: div(ventas, vs.length),
    };
  }).sort((a, b) => Number(b.neta) - Number(a.neta));
  const tot = (k: string) => suma(filas, (f) => Number(f[k]));
  const ventas = tot("ventas");
  const gastosCat = [...agrupar(d.gastos, (g) => `${g.categoria}|${g.ruta}`)].map(([k, gs]): Fila => {
    const [categoria, ruta] = k.split("|");
    return { categoria, ruta, n: gs.length, monto: suma(gs, (g) => g.monto), pct: div(suma(gs, (g) => g.monto), suma(d.gastos, (g) => g.monto)) };
  }).sort((a, b) => Number(b.monto) - Number(a.monto));
  const mejor = filas[0];
  return {
    titulo: "Rentabilidad por ruta",
    descripcion: "Ventas menos costo de mercadería, gastos de ruta y devoluciones. Permite rebalancear rutas y controlar gastos operativos.",
    indicadores: [
      { label: "Ventas", valor: ventas, tipo: "moneda" },
      { label: "Utilidad neta", valor: tot("neta"), tipo: "moneda" },
      { label: "Margen neto", valor: div(tot("neta"), ventas), tipo: "pct" },
      { label: "Gasto por ₡1.000 vendidos", valor: div(tot("gastos"), ventas) * 1000, tipo: "moneda" },
      { label: "Rutas con pérdida", valor: filas.filter((f) => Number(f.neta) < 0).length, tipo: "entero" },
      { label: `Más rentable: ${mejor?.ruta ?? "—"}`, valor: Number(mejor?.neta ?? 0), tipo: "moneda" },
    ],
    secciones: [
      {
        titulo: "Estado de resultados por ruta",
        columnas: [
          { key: "ruta", titulo: "Ruta", tipo: "texto" },
          { key: "n", titulo: "Ventas", tipo: "entero" },
          { key: "clientes", titulo: "Clientes", tipo: "entero" },
          { key: "ventas", titulo: "Total vendido", tipo: "moneda" },
          { key: "costo", titulo: "Costo mercadería", tipo: "moneda" },
          { key: "bruta", titulo: "Utilidad bruta", tipo: "moneda" },
          { key: "gastos", titulo: "Gastos", tipo: "moneda" },
          { key: "devol", titulo: "Devoluciones", tipo: "moneda" },
          { key: "neta", titulo: "Utilidad neta", tipo: "moneda" },
          { key: "margen", titulo: "Margen neto", tipo: "pct" },
          { key: "costoMil", titulo: "Gasto x ₡1.000", tipo: "moneda" },
          { key: "ticket", titulo: "Ticket prom.", tipo: "moneda" },
        ],
        filas,
        totales: {
          ruta: "TOTAL", n: tot("n"), clientes: new Set(d.ventas.map((v) => v.clienteId)).size, ventas, costo: tot("costo"), bruta: tot("bruta"),
          gastos: tot("gastos"), devol: tot("devol"), neta: tot("neta"), margen: div(tot("neta"), ventas), costoMil: div(tot("gastos"), ventas) * 1000, ticket: div(ventas, tot("n")),
        },
        nota: "Costo de mercadería según el costo de la lista de precios de cada ruta.",
      },
      {
        titulo: "Gastos por categoría",
        columnas: [
          { key: "categoria", titulo: "Categoría", tipo: "texto" },
          { key: "ruta", titulo: "Ruta", tipo: "texto" },
          { key: "n", titulo: "Registros", tipo: "entero" },
          { key: "monto", titulo: "Monto", tipo: "moneda" },
          { key: "pct", titulo: "% del gasto", tipo: "pct" },
        ],
        filas: gastosCat,
        totales: { categoria: "TOTAL", n: d.gastos.length, monto: suma(d.gastos, (g) => g.monto), pct: d.gastos.length ? 1 : 0 },
      },
    ],
  };
}

export function mermasDevoluciones(d: DatosReportes): Reporte {
  const lineas = d.devoluciones.flatMap((x) => x.lineas.map((l) => ({ ...l, cliente: x.cliente, ruta: x.ruta })));
  const total = suma(lineas, (l) => l.monto);
  const ventas = suma(d.ventas, (v) => v.total);
  const merma = lineas.filter((l) => l.destino === "merma");
  const porProd = [...agrupar(lineas, (l) => l.producto)].map(([producto, ls]): Fila => ({
    producto,
    unidades: suma(ls, (l) => l.cantidad),
    merma: suma(ls.filter((l) => l.destino === "merma"), (l) => l.cantidad),
    reingreso: suma(ls.filter((l) => l.destino !== "merma"), (l) => l.cantidad),
    monto: suma(ls, (l) => l.monto),
    pct: div(suma(ls, (l) => l.monto), total),
  })).sort((a, b) => Number(b.monto) - Number(a.monto));
  const porMotivo = [...agrupar(lineas, (l) => MOTIVOS[l.motivo] ?? l.motivo)].map(([motivo, ls]): Fila => ({
    motivo, casos: ls.length, unidades: suma(ls, (l) => l.cantidad), monto: suma(ls, (l) => l.monto), pct: div(suma(ls, (l) => l.monto), total),
  })).sort((a, b) => Number(b.monto) - Number(a.monto));
  const porCliente = [...agrupar(d.devoluciones, (x) => `${x.cliente}|${x.ruta}`)].map(([k, xs]): Fila => {
    const [cliente, ruta] = k.split("|");
    return { cliente, ruta, n: xs.length, monto: suma(xs, (x) => x.total) };
  }).sort((a, b) => Number(b.monto) - Number(a.monto));
  return {
    titulo: "Mermas y devoluciones",
    descripcion: "Producto devuelto por motivo, producto y cliente. Ayuda a ajustar la carga del camión y detectar problemas de calidad.",
    indicadores: [
      { label: "Total devuelto", valor: total, tipo: "moneda" },
      { label: "Tasa sobre ventas", valor: div(total, ventas), tipo: "pct" },
      { label: "Unidades devueltas", valor: suma(lineas, (l) => l.cantidad), tipo: "entero" },
      { label: "Pérdida por merma", valor: suma(merma, (l) => l.monto), tipo: "moneda" },
      { label: "Reingresado a bodega", valor: total - suma(merma, (l) => l.monto), tipo: "moneda" },
      { label: "Devoluciones", valor: d.devoluciones.length, tipo: "entero" },
    ],
    secciones: [
      {
        titulo: "Por producto",
        columnas: [
          { key: "producto", titulo: "Producto", tipo: "texto" },
          { key: "unidades", titulo: "Unidades", tipo: "entero" },
          { key: "merma", titulo: "A merma", tipo: "entero" },
          { key: "reingreso", titulo: "Reingreso", tipo: "entero" },
          { key: "monto", titulo: "Monto", tipo: "moneda" },
          { key: "pct", titulo: "% del total", tipo: "pct" },
        ],
        filas: porProd,
        totales: { producto: "TOTAL", unidades: suma(lineas, (l) => l.cantidad), merma: suma(merma, (l) => l.cantidad), reingreso: suma(lineas, (l) => l.cantidad) - suma(merma, (l) => l.cantidad), monto: total, pct: total ? 1 : 0 },
      },
      {
        titulo: "Por motivo",
        columnas: [
          { key: "motivo", titulo: "Motivo", tipo: "texto" },
          { key: "casos", titulo: "Líneas", tipo: "entero" },
          { key: "unidades", titulo: "Unidades", tipo: "entero" },
          { key: "monto", titulo: "Monto", tipo: "moneda" },
          { key: "pct", titulo: "% del total", tipo: "pct" },
        ],
        filas: porMotivo,
      },
      {
        titulo: "Por cliente",
        columnas: [
          { key: "cliente", titulo: "Cliente", tipo: "texto" },
          { key: "ruta", titulo: "Ruta", tipo: "texto" },
          { key: "n", titulo: "Devoluciones", tipo: "entero" },
          { key: "monto", titulo: "Monto", tipo: "moneda" },
        ],
        filas: porCliente,
      },
    ],
  };
}

export const TRAMOS = [
  { label: "0-15 días", min: 0, max: 15 },
  { label: "16-30 días", min: 16, max: 30 },
  { label: "31-60 días", min: 31, max: 60 },
  { label: "Más de 60 días", min: 61, max: Infinity },
];

export function carteraCobranza(d: DatosReportes): Reporte {
  const abiertos = d.creditos.filter((c) => c.saldo > 0).map((c) => ({ ...c, dias: dias(c.fecha, d.hoy) }));
  const saldo = suma(abiertos, (c) => c.saldo);
  const otorgado = suma(d.ventas.filter((v) => v.metodo !== "contado"), (v) => v.total);
  const cobrado = suma(d.abonos, (a) => a.monto);
  const aging: Fila[] = TRAMOS.map((t) => {
    const cs = abiertos.filter((c) => c.dias >= t.min && c.dias <= t.max);
    return { tramo: t.label, n: cs.length, saldo: suma(cs, (c) => c.saldo), pct: div(suma(cs, (c) => c.saldo), saldo) };
  });
  const riesgo = [...agrupar(abiertos, (c) => `${c.cliente}|${c.ruta}`)].map(([k, cs]): Fila => {
    const [cliente, ruta] = k.split("|");
    const maxDias = Math.max(...cs.map((c) => c.dias));
    return { cliente, ruta, n: cs.length, saldo: suma(cs, (c) => c.saldo), vencido: suma(cs.filter((c) => c.dias > 30), (c) => c.saldo), dias: maxDias };
  }).sort((a, b) => Number(b.vencido) - Number(a.vencido) || Number(b.saldo) - Number(a.saldo));
  return {
    titulo: "Cartera y cobranza",
    descripcion: "Saldo pendiente por antigüedad y clientes de mayor riesgo. La antigüedad se cuenta desde la fecha de cada crédito.",
    indicadores: [
      { label: "Saldo por cobrar", valor: saldo, tipo: "moneda" },
      { label: "Crédito otorgado (período)", valor: otorgado, tipo: "moneda" },
      { label: "Cobrado (período)", valor: cobrado, tipo: "moneda" },
      { label: "Efectividad de cobro", valor: div(cobrado, otorgado), tipo: "pct" },
      { label: "Saldo con más de 30 días", valor: suma(abiertos.filter((c) => c.dias > 30), (c) => c.saldo), tipo: "moneda" },
      { label: "Clientes con saldo", valor: riesgo.length, tipo: "entero" },
    ],
    secciones: [
      {
        titulo: "Antigüedad de saldos",
        columnas: [
          { key: "tramo", titulo: "Antigüedad", tipo: "texto" },
          { key: "n", titulo: "Créditos", tipo: "entero" },
          { key: "saldo", titulo: "Saldo", tipo: "moneda" },
          { key: "pct", titulo: "% del saldo", tipo: "pct" },
        ],
        filas: aging,
        totales: { tramo: "TOTAL", n: abiertos.length, saldo, pct: saldo ? 1 : 0 },
      },
      {
        titulo: "Clientes por riesgo",
        columnas: [
          { key: "cliente", titulo: "Cliente", tipo: "texto" },
          { key: "ruta", titulo: "Ruta", tipo: "texto" },
          { key: "n", titulo: "Créditos", tipo: "entero" },
          { key: "saldo", titulo: "Saldo total", tipo: "moneda" },
          { key: "vencido", titulo: "Más de 30 días", tipo: "moneda" },
          { key: "dias", titulo: "Días deuda más antigua", tipo: "entero" },
        ],
        filas: riesgo,
        totales: { cliente: "TOTAL", n: abiertos.length, saldo, vencido: suma(abiertos.filter((c) => c.dias > 30), (c) => c.saldo) },
        nota: "El saldo por cobrar es el actual, sin depender del período elegido.",
      },
    ],
  };
}

export function clientesRiesgo(d: DatosReportes): Reporte {
  const conDias = d.clientes.map((c) => ({ ...c, dias: c.ultimaCompra ? dias(c.ultimaCompra, d.hoy) : null }));
  const inactivos = conDias.filter((c) => c.dias === null || c.dias > 15).sort((a, b) => (b.dias ?? 9999) - (a.dias ?? 9999));
  const total = suma(d.ventas, (v) => v.total);
  let acum = 0;
  const pareto = [...agrupar(d.ventas, (v) => `${v.cliente}|${v.ruta}`)].map(([k, vs]) => {
    const [cliente, ruta] = k.split("|");
    return { cliente, ruta, n: vs.length, total: suma(vs, (v) => v.total) };
  }).sort((a, b) => b.total - a.total).map((f): Fila => {
    acum += f.total;
    return { ...f, pct: div(f.total, total), acum: div(acum, total), clase: div(acum - f.total, total) < 0.8 ? "A (80%)" : "B" };
  });
  return {
    titulo: "Clientes en riesgo y principales",
    descripcion: "Clientes activos que dejaron de comprar y clientes que concentran las ventas (Pareto 80/20).",
    indicadores: [
      { label: "Clientes activos", valor: d.clientes.length, tipo: "entero" },
      { label: "Compraron en el período", valor: new Set(d.ventas.map((v) => v.clienteId)).size, tipo: "entero" },
      { label: "Sin compra 16-30 días", valor: conDias.filter((c) => c.dias !== null && c.dias > 15 && c.dias <= 30).length, tipo: "entero" },
      { label: "Sin compra más de 30 días", valor: conDias.filter((c) => c.dias === null || c.dias > 30).length, tipo: "entero" },
      { label: "Clientes clase A", valor: pareto.filter((p) => p.clase === "A (80%)").length, tipo: "entero" },
    ],
    secciones: [
      {
        titulo: "Clientes sin comprar",
        columnas: [
          { key: "nombre", titulo: "Cliente", tipo: "texto" },
          { key: "ruta", titulo: "Ruta", tipo: "texto" },
          { key: "ultimaCompra", titulo: "Última compra", tipo: "fecha" },
          { key: "dias", titulo: "Días sin comprar", tipo: "entero" },
          { key: "compras90", titulo: "Compras 90 días", tipo: "entero" },
          { key: "total90", titulo: "Total 90 días", tipo: "moneda" },
        ],
        filas: inactivos.map((c) => ({ ...c, dias: c.dias ?? "Nunca" })),
        nota: "Incluye clientes activos con más de 15 días sin comprar, contados a hoy.",
      },
      {
        titulo: "Principales clientes",
        columnas: [
          { key: "cliente", titulo: "Cliente", tipo: "texto" },
          { key: "ruta", titulo: "Ruta", tipo: "texto" },
          { key: "n", titulo: "Compras", tipo: "entero" },
          { key: "total", titulo: "Total", tipo: "moneda" },
          { key: "pct", titulo: "% ventas", tipo: "pct" },
          { key: "acum", titulo: "% acumulado", tipo: "pct" },
          { key: "clase", titulo: "Clase", tipo: "texto" },
        ],
        filas: pareto,
        totales: { cliente: "TOTAL", n: d.ventas.length, total, pct: total ? 1 : 0 },
      },
    ],
  };
}

export function productosRotacion(d: DatosReportes): Reporte {
  const total = suma(d.detalles, (x) => x.total);
  const top = [...agrupar(d.detalles, (x) => x.productoId ?? x.producto)].map(([, xs]): Fila => {
    const t = suma(xs, (x) => x.total);
    const c = suma(xs, (x) => x.costo);
    return { producto: xs[0].producto, categoria: xs[0].categoria, unidades: suma(xs, (x) => x.cantidad), total: t, utilidad: t - c, margen: div(t - c, t), pct: div(t, total) };
  }).sort((a, b) => Number(b.total) - Number(a.total));
  const vendidos = new Set(d.detalles.map((x) => x.productoId));
  const sinRot = d.productos.filter((p) => p.existencia > 0 && !vendidos.has(p.id)).map((p): Fila => ({
    producto: p.nombre, categoria: p.categoria, existencia: p.existencia, valor: p.existencia * p.costo,
  })).sort((a, b) => Number(b.valor) - Number(a.valor));
  const cats = [...agrupar(d.detalles, (x) => x.categoria)].map(([categoria, xs]): Fila => ({
    categoria, unidades: suma(xs, (x) => x.cantidad), total: suma(xs, (x) => x.total), pct: div(suma(xs, (x) => x.total), total),
  })).sort((a, b) => Number(b.total) - Number(a.total));
  return {
    titulo: "Productos y rotación",
    descripcion: "Productos que más venden y dejan utilidad, participación por categoría e inventario sin movimiento en el período.",
    indicadores: [
      { label: "Vendido en productos", valor: total, tipo: "moneda" },
      { label: "Unidades vendidas", valor: suma(d.detalles, (x) => x.cantidad), tipo: "entero" },
      { label: "Utilidad bruta", valor: total - suma(d.detalles, (x) => x.costo), tipo: "moneda" },
      { label: "Productos vendidos", valor: top.length, tipo: "entero" },
      { label: "Productos sin rotación", valor: sinRot.length, tipo: "entero" },
      { label: "Inventario detenido", valor: suma(sinRot, (f) => Number(f.valor)), tipo: "moneda" },
    ],
    secciones: [
      {
        titulo: "Ranking de productos",
        columnas: [
          { key: "producto", titulo: "Producto", tipo: "texto" },
          { key: "categoria", titulo: "Categoría", tipo: "texto" },
          { key: "unidades", titulo: "Unidades", tipo: "entero" },
          { key: "total", titulo: "Vendido", tipo: "moneda" },
          { key: "utilidad", titulo: "Utilidad", tipo: "moneda" },
          { key: "margen", titulo: "Margen", tipo: "pct" },
          { key: "pct", titulo: "% ventas", tipo: "pct" },
        ],
        filas: top,
        totales: { producto: "TOTAL", unidades: suma(d.detalles, (x) => x.cantidad), total, utilidad: total - suma(d.detalles, (x) => x.costo), margen: div(total - suma(d.detalles, (x) => x.costo), total), pct: total ? 1 : 0 },
      },
      {
        titulo: "Ventas por categoría",
        columnas: [
          { key: "categoria", titulo: "Categoría", tipo: "texto" },
          { key: "unidades", titulo: "Unidades", tipo: "entero" },
          { key: "total", titulo: "Vendido", tipo: "moneda" },
          { key: "pct", titulo: "% ventas", tipo: "pct" },
        ],
        filas: cats,
      },
      {
        titulo: "Inventario sin rotación",
        columnas: [
          { key: "producto", titulo: "Producto", tipo: "texto" },
          { key: "categoria", titulo: "Categoría", tipo: "texto" },
          { key: "existencia", titulo: "Existencia", tipo: "entero" },
          { key: "valor", titulo: "Valor al costo", tipo: "moneda" },
        ],
        filas: sinRot,
        totales: { producto: "TOTAL", existencia: suma(sinRot, (f) => Number(f.existencia)), valor: suma(sinRot, (f) => Number(f.valor)) },
      },
    ],
  };
}

export function detalleVentas(d: DatosReportes): Reporte {
  const total = suma(d.ventas, (v) => v.total);
  const contado = suma(d.ventas.filter((v) => v.metodo === "contado"), (v) => v.total);
  return {
    titulo: "Detalle de ventas",
    descripcion: "Todas las ventas del período con cliente, ruta y forma de pago.",
    indicadores: [
      { label: "Ventas", valor: d.ventas.length, tipo: "entero" },
      { label: "Total", valor: total, tipo: "moneda" },
      { label: "Contado", valor: contado, tipo: "moneda" },
      { label: "Crédito", valor: total - contado, tipo: "moneda" },
    ],
    secciones: [{
      titulo: "Ventas",
      columnas: [
        { key: "fecha", titulo: "Fecha", tipo: "fecha" },
        { key: "cliente", titulo: "Cliente", tipo: "texto" },
        { key: "ruta", titulo: "Ruta", tipo: "texto" },
        { key: "metodo", titulo: "Método", tipo: "texto" },
        { key: "total", titulo: "Total", tipo: "moneda" },
      ],
      filas: d.ventas.map((v) => ({ ...v, metodo: v.metodo === "contado" ? "Contado" : "Crédito" })),
      totales: { fecha: "TOTAL", total },
    }],
  };
}

export function detalleGastos(d: DatosReportes): Reporte {
  const total = suma(d.gastos, (g) => g.monto);
  return {
    titulo: "Detalle de gastos",
    descripcion: "Todos los gastos del período por categoría y ruta.",
    indicadores: [
      { label: "Registros", valor: d.gastos.length, tipo: "entero" },
      { label: "Total gastos", valor: total, tipo: "moneda" },
    ],
    secciones: [{
      titulo: "Gastos",
      columnas: [
        { key: "fecha", titulo: "Fecha", tipo: "fecha" },
        { key: "categoria", titulo: "Categoría", tipo: "texto" },
        { key: "descripcion", titulo: "Descripción", tipo: "texto" },
        { key: "ruta", titulo: "Ruta", tipo: "texto" },
        { key: "monto", titulo: "Monto", tipo: "moneda" },
      ],
      filas: d.gastos,
      totales: { fecha: "TOTAL", monto: total },
    }],
  };
}

/** Lunes (YYYY-MM-DD) de la semana de una fecha, en hora local. */
export function inicioSemana(fecha: string): string {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return "";
  const dia = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dia);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function costosGastos(d: DatosReportes): Reporte {
  const costoProd = suma(d.detalles, (x) => x.costo);
  const gastos = suma(d.gastos, (g) => g.monto);
  const rutas = new Set([...d.detalles.map((x) => x.ruta), ...d.gastos.map((g) => g.ruta)]);
  const porRuta: Fila[] = [...rutas].map((ruta) => {
    const c = suma(d.detalles.filter((x) => x.ruta === ruta), (x) => x.costo);
    const g = suma(d.gastos.filter((x) => x.ruta === ruta), (x) => x.monto);
    return { ruta, costo: c, gastos: g, total: c + g, pct: div(c + g, costoProd + gastos) };
  }).sort((a, b) => Number(b.total) - Number(a.total));

  const semanas: Fila[] = [...agrupar(d.detalles, (x) => `${inicioSemana(x.fecha ?? "")}|${x.ruta}`)].map(([k, xs]) => {
    const [semana, ruta] = k.split("|");
    return { semana: semana ? semana + "T12:00:00" : "—", ruta, unidades: suma(xs, (x) => x.cantidad), costo: suma(xs, (x) => x.costo) };
  }).sort((a, b) => String(a.semana).localeCompare(String(b.semana)) || String(a.ruta).localeCompare(String(b.ruta)));

  const semanaGeneral: Fila[] = [...agrupar(d.detalles, (x) => inicioSemana(x.fecha ?? ""))].map(([s, xs]) => ({
    semana: s ? s + "T12:00:00" : "—", unidades: suma(xs, (x) => x.cantidad), costo: suma(xs, (x) => x.costo),
  })).sort((a, b) => String(a.semana).localeCompare(String(b.semana)));

  const productos: Fila[] = [...agrupar(d.detalles, (x) => `${x.producto}|${x.ruta}`)].map(([k, xs]) => {
    const [producto, ruta] = k.split("|");
    const u = suma(xs, (x) => x.cantidad), c = suma(xs, (x) => x.costo);
    return { producto, ruta, unidades: u, unit: div(c, u), costo: c };
  }).sort((a, b) => Number(b.costo) - Number(a.costo));

  const meses: Fila[] = [...agrupar(d.gastos, (g) => `${g.fecha.slice(0, 7)}|${g.categoria}`)].map(([k, gs]) => {
    const [mes, categoria] = k.split("|");
    return { mes, categoria, n: gs.length, monto: suma(gs, (g) => g.monto) };
  }).sort((a, b) => String(a.mes).localeCompare(String(b.mes)) || Number(b.monto) - Number(a.monto));

  return {
    titulo: "Costos y gastos",
    descripcion: "Costo de productos vendidos por semana, por ruta y general, y gastos operativos del mes por categoría.",
    indicadores: [
      { label: "Costo de productos", valor: costoProd, tipo: "moneda" },
      { label: "Gastos operativos", valor: gastos, tipo: "moneda" },
      { label: "Total costos + gastos", valor: costoProd + gastos, tipo: "moneda" },
      { label: "Rutas", valor: rutas.size, tipo: "entero" },
    ],
    secciones: [
      {
        titulo: "Costos totales por ruta",
        columnas: [
          { key: "ruta", titulo: "Ruta", tipo: "texto" },
          { key: "costo", titulo: "Costo productos", tipo: "moneda" },
          { key: "gastos", titulo: "Gastos", tipo: "moneda" },
          { key: "total", titulo: "Total", tipo: "moneda" },
          { key: "pct", titulo: "% del total", tipo: "pct" },
        ],
        filas: porRuta,
        totales: { ruta: "TOTAL", costo: costoProd, gastos, total: costoProd + gastos, pct: porRuta.length ? 1 : 0 },
      },
      {
        titulo: "Gastos del mes por categoría",
        columnas: [
          { key: "mes", titulo: "Mes", tipo: "texto" },
          { key: "categoria", titulo: "Categoría", tipo: "texto" },
          { key: "n", titulo: "Registros", tipo: "entero" },
          { key: "monto", titulo: "Monto", tipo: "moneda" },
        ],
        filas: meses,
        totales: { mes: "TOTAL", n: d.gastos.length, monto: gastos },
      },
      {
        titulo: "Costo de productos por semana (general)",
        columnas: [
          { key: "semana", titulo: "Semana del", tipo: "fecha" },
          { key: "unidades", titulo: "Unidades", tipo: "numero" },
          { key: "costo", titulo: "Costo", tipo: "moneda" },
        ],
        filas: semanaGeneral,
        totales: { semana: "TOTAL", unidades: suma(d.detalles, (x) => x.cantidad), costo: costoProd },
      },
      {
        titulo: "Costo de productos por semana y ruta",
        columnas: [
          { key: "semana", titulo: "Semana del", tipo: "fecha" },
          { key: "ruta", titulo: "Ruta", tipo: "texto" },
          { key: "unidades", titulo: "Unidades", tipo: "numero" },
          { key: "costo", titulo: "Costo", tipo: "moneda" },
        ],
        filas: semanas,
        totales: { semana: "TOTAL", unidades: suma(d.detalles, (x) => x.cantidad), costo: costoProd },
      },
      {
        titulo: "Costo por producto y ruta",
        columnas: [
          { key: "producto", titulo: "Producto", tipo: "texto" },
          { key: "ruta", titulo: "Ruta", tipo: "texto" },
          { key: "unidades", titulo: "Unidades", tipo: "numero" },
          { key: "unit", titulo: "Costo unit. prom.", tipo: "moneda" },
          { key: "costo", titulo: "Costo total", tipo: "moneda" },
        ],
        filas: productos,
        totales: { producto: "TOTAL", unidades: suma(d.detalles, (x) => x.cantidad), costo: costoProd },
        nota: "Costo congelado al momento de la venta (o el de la lista de la ruta para ventas anteriores).",
      },
    ],
  };
}

export { DESTINOS };
