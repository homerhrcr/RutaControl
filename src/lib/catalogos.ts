import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type OpcionCatalogo = {
  id: string; catalogo: string; codigo: string; etiqueta: string; descripcion: string | null;
  activo: boolean; orden: number; predeterminado: boolean; protegido: boolean;
};

export type CatalogoOpcionKey = "motivo_devolucion" | "destino_devolucion" | "tipo_identificacion" | "tarifa_iva" | "metodo_pago" | "motivo_cancelacion_pedido";
export type CatalogoTablaKey = "categorias" | "categorias_gasto" | "rutas";

export type DefCatalogo = {
  key: CatalogoOpcionKey | CatalogoTablaKey;
  tipo: "opciones" | "tabla";
  titulo: string;
  usadoEn: string;
  /** Explica qué no se puede cambiar y por qué. */
  restriccion?: string;
};

/** Inventario de catálogos administrables del sistema. */
export const DEFINICIONES: DefCatalogo[] = [
  { key: "categorias", tipo: "tabla", titulo: "Categorías de productos", usadoEn: "Productos (formulario y filtros), catálogo de Telegram, reportes" },
  { key: "categorias_gasto", tipo: "tabla", titulo: "Categorías de gastos", usadoEn: "Gastos (formulario y filtro), reportes de gastos" },
  { key: "rutas", tipo: "tabla", titulo: "Rutas", usadoEn: "Clientes, Pedidos, Devoluciones, Carga de camión, Telegram, Precios especiales, Gastos" },
  { key: "motivo_devolucion", tipo: "opciones", titulo: "Motivos de devolución", usadoEn: "Devoluciones (cada línea) y solicitudes de devolución por Telegram" },
  { key: "destino_devolucion", tipo: "opciones", titulo: "Destino de la devolución", usadoEn: "Devoluciones (cada línea)", restriccion: "El código decide si el producto regresa a bodega o se desecha: solo se edita el nombre visible." },
  { key: "tipo_identificacion", tipo: "opciones", titulo: "Tipos de identificación", usadoEn: "Clientes, Datos de la empresa, Facturación", restriccion: "Códigos oficiales de Hacienda: se edita el nombre, el orden y si está activo." },
  { key: "tarifa_iva", tipo: "opciones", titulo: "Tarifas de IVA", usadoEn: "Productos", restriccion: "Tarifas oficiales de Hacienda: se edita el nombre, el orden, activo y la predeterminada." },
  { key: "metodo_pago", tipo: "opciones", titulo: "Métodos de pago", usadoEn: "Ventas, tiquetes y reportes", restriccion: "El sistema calcula créditos con estos códigos: solo se edita el nombre visible." },
  { key: "motivo_cancelacion_pedido", tipo: "opciones", titulo: "Motivos de cancelación de pedidos", usadoEn: "Preventa (cancelar pedido)" },
];

export function useOpciones(catalogo?: CatalogoOpcionKey) {
  const { organizacionActiva } = useAuth();
  const q = useQuery({
    queryKey: ["catalogo_opciones", organizacionActiva?.id],
    enabled: !!organizacionActiva,
    queryFn: async () => {
      const { data, error } = await supabase.from("catalogo_opciones").select("*").order("orden");
      if (error) throw error;
      return data as OpcionCatalogo[];
    },
  });
  return { ...q, data: catalogo ? q.data?.filter((o) => o.catalogo === catalogo) : q.data };
}
