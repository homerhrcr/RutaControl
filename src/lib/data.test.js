import { beforeEach, expect, mock, test } from "bun:test";

let tables;
const client = {
  async rpc(name, args) {
    if (name !== "pos_registrar_venta") throw new Error("Unexpected RPC");
    if (!tables.ventas.some(v => v.id === args.p.id)) tables.ventas.push({ id: args.p.id, pos_datos: args.p.pos, total: 2500 });
    return { data: tables.ventas.find(v => v.id === args.p.id), error: null };
  },
  from(table) {
    let action = "select";
    let payload;
    let countOnly = false;
    const filters = [];
    const query = {
      select(_columns, options) { countOnly = options?.head ?? false; return query; },
      eq(key, value) { filters.push([key, value]); return query; },
      insert(value) { action = "insert"; payload = value; return query; },
      update(value) { action = "update"; payload = value; return query; },
      single() { return execute(true); },
      maybeSingle() { return execute(true); },
      then(resolve, reject) { return execute(false).then(resolve, reject); },
    };
    async function execute(single) {
      const rows = tables[table];
      const matches = rows.filter(row => filters.every(([key, value]) => row[key] === value));
      let data = matches;
      if (action === "insert") {
        data = (Array.isArray(payload) ? payload : [payload]).map(row => ({ id: `${table}-${rows.length}`, ...row }));
        rows.push(...data);
      } else if (action === "update") {
        matches.forEach(row => Object.assign(row, payload));
      }
      return { data: single ? data[0] ?? null : data, error: null, count: countOnly ? matches.length : null };
    }
    return query;
  },
};
mock.module("@/integrations/supabase/client", () => ({ supabase: client }));
mock.module("./telegram-notificar", () => ({ notificarDocumentoTelegram: async () => {} }));
const { registrarVenta } = await import("./data");

beforeEach(() => {
  tables = {
    ventas: [], detalle_ventas: [], movimientos_inventario: [], creditos: [], auditoria: [],
    productos: [{ id: "leche", existencia: 20 }, { id: "queso", existencia: 10 }],
  };
});

const pedido = {
  id: "pedido-duplicado", cliente_id: "cliente", vendedor_id: "vendedor", ruta_id: "ruta",
  descuento: 0, metodo: "credito",
  items: [
    { producto_id: "leche", nombre: "Leche", cantidad: 2, precio: 1000 },
    { producto_id: "leche", nombre: "Leche", cantidad: 3, precio: 900 },
    { producto_id: "queso", nombre: "Queso", cantidad: 1, precio: 2000 },
  ],
};

test("entregar 2 leches y otras 3 descuenta 5 y conserva las líneas y precios", async () => {
  await registrarVenta(pedido);
  expect(tables.productos.map(p => p.existencia)).toEqual([15, 9]);
  expect(tables.movimientos_inventario.map(m => [m.producto_id, m.cantidad])).toEqual([["leche", 5], ["queso", 1]]);
  expect(tables.detalle_ventas.map(d => [d.cantidad, d.precio_unitario])).toEqual([[2, 1000], [3, 900], [1, 2000]]);
  expect(tables.creditos[0].saldo).toBe(6700);
});

test("reintentar la entrega no vuelve a descontar las 5 leches ni duplica el crédito", async () => {
  await registrarVenta(pedido);
  await registrarVenta(pedido);
  expect(tables.productos.map(p => p.existencia)).toEqual([15, 9]);
  expect(tables.movimientos_inventario).toHaveLength(2);
  expect(tables.ventas).toHaveLength(1);
  expect(tables.detalle_ventas).toHaveLength(3);
  expect(tables.creditos).toHaveLength(1);
});
test("POS reintenta por el RPC atómico y conserva cliente nulo y datos de cobro", async () => {
  const p = { ...pedido, id: "pos-unica", cliente_id: null, metodo: "contado", pos: { caja_id: "caja", organization_id: "empresa", recibido: 5000, medio: "efectivo" } };
  await registrarVenta(p); await registrarVenta(p);
  expect(tables.ventas).toHaveLength(1);
  expect(tables.ventas[0].pos_datos.recibido).toBe(5000);
  expect(tables.movimientos_inventario).toHaveLength(0);
});