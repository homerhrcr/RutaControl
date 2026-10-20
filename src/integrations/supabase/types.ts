export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      abonos: {
        Row: {
          cliente_id: string | null
          cobrador_id: string | null
          created_at: string
          credito_id: string
          fecha: string
          id: string
          monto: number
          organization_id: string
        }
        Insert: {
          cliente_id?: string | null
          cobrador_id?: string | null
          created_at?: string
          credito_id: string
          fecha?: string
          id?: string
          monto?: number
          organization_id?: string
        }
        Update: {
          cliente_id?: string | null
          cobrador_id?: string | null
          created_at?: string
          credito_id?: string
          fecha?: string
          id?: string
          monto?: number
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "abonos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abonos_credito_id_fkey"
            columns: ["credito_id"]
            isOneToOne: false
            referencedRelation: "creditos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abonos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria: {
        Row: {
          accion: string
          detalle: Json | null
          entidad: string | null
          fecha: string
          id: string
          organization_id: string
          usuario_id: string | null
        }
        Insert: {
          accion: string
          detalle?: Json | null
          entidad?: string | null
          fecha?: string
          id?: string
          organization_id?: string
          usuario_id?: string | null
        }
        Update: {
          accion?: string
          detalle?: Json | null
          entidad?: string | null
          fecha?: string
          id?: string
          organization_id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cargas_camion: {
        Row: {
          cerrada_en: string | null
          created_at: string
          estado: string
          fecha: string
          id: string
          notas: string | null
          organization_id: string
          ruta_id: string
          updated_at: string
          vehiculo: string
          vendedor_id: string
        }
        Insert: {
          cerrada_en?: string | null
          created_at?: string
          estado?: string
          fecha?: string
          id?: string
          notas?: string | null
          organization_id?: string
          ruta_id: string
          updated_at?: string
          vehiculo?: string
          vendedor_id: string
        }
        Update: {
          cerrada_en?: string | null
          created_at?: string
          estado?: string
          fecha?: string
          id?: string
          notas?: string | null
          organization_id?: string
          ruta_id?: string
          updated_at?: string
          vehiculo?: string
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargas_camion_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargas_camion_ruta_id_fkey"
            columns: ["ruta_id"]
            isOneToOne: false
            referencedRelation: "rutas"
            referencedColumns: ["id"]
          },
        ]
      }
      cargas_camion_detalle: {
        Row: {
          carga_id: string
          devuelto: number
          extra: number
          id: string
          merma: number
          nombre_producto: string
          organization_id: string
          preventa: number
          producto_id: string
          vendido: number
        }
        Insert: {
          carga_id: string
          devuelto?: number
          extra?: number
          id?: string
          merma?: number
          nombre_producto: string
          organization_id?: string
          preventa?: number
          producto_id: string
          vendido?: number
        }
        Update: {
          carga_id?: string
          devuelto?: number
          extra?: number
          id?: string
          merma?: number
          nombre_producto?: string
          organization_id?: string
          preventa?: number
          producto_id?: string
          vendido?: number
        }
        Relationships: [
          {
            foreignKeyName: "cargas_camion_detalle_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas_camion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargas_camion_detalle_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargas_camion_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          created_at: string
          id: string
          nombre: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nombre: string
          organization_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_gasto: {
        Row: {
          created_at: string
          id: string
          nombre: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nombre: string
          organization_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_gasto_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_rutas: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          orden: number
          organization_id: string
          ruta_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          orden?: number
          organization_id?: string
          ruta_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          orden?: number
          organization_id?: string
          ruta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_rutas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_rutas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_rutas_ruta_id_fkey"
            columns: ["ruta_id"]
            isOneToOne: false
            referencedRelation: "rutas"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          activo: boolean
          canton: string | null
          correo_fe: string | null
          created_at: string
          direccion: string | null
          distrito: string | null
          foto_url: string | null
          id: string
          identificacion: string | null
          latitud: number | null
          lista_precio_id: string | null
          longitud: number | null
          nombre: string
          organization_id: string
          provincia: string | null
          referencia: string | null
          ruta_id: string | null
          telefono: string | null
          tipo_identificacion: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          canton?: string | null
          correo_fe?: string | null
          created_at?: string
          direccion?: string | null
          distrito?: string | null
          foto_url?: string | null
          id?: string
          identificacion?: string | null
          latitud?: number | null
          lista_precio_id?: string | null
          longitud?: number | null
          nombre: string
          organization_id?: string
          provincia?: string | null
          referencia?: string | null
          ruta_id?: string | null
          telefono?: string | null
          tipo_identificacion?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          canton?: string | null
          correo_fe?: string | null
          created_at?: string
          direccion?: string | null
          distrito?: string | null
          foto_url?: string | null
          id?: string
          identificacion?: string | null
          latitud?: number | null
          lista_precio_id?: string | null
          longitud?: number | null
          nombre?: string
          organization_id?: string
          provincia?: string | null
          referencia?: string | null
          ruta_id?: string | null
          telefono?: string | null
          tipo_identificacion?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_lista_empresa_fk"
            columns: ["organization_id", "lista_precio_id"]
            isOneToOne: false
            referencedRelation: "listas_precios"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "clientes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_ruta_id_fkey"
            columns: ["ruta_id"]
            isOneToOne: false
            referencedRelation: "rutas"
            referencedColumns: ["id"]
          },
        ]
      }
      config_fiscal: {
        Row: {
          actividad_economica: string
          activo: boolean
          ambiente: string
          canton: string | null
          correo: string | null
          distrito: string | null
          identificacion: string
          logo_data: string | null
          nombre_comercial: string | null
          nombre_fiscal: string
          organization_id: string
          otras_senas: string | null
          pie_reportes: string | null
          provincia: string | null
          sitio_web: string | null
          sucursal: string
          telefono: string | null
          terminal: string
          tipo_identificacion: string
          updated_at: string
        }
        Insert: {
          actividad_economica?: string
          activo?: boolean
          ambiente?: string
          canton?: string | null
          correo?: string | null
          distrito?: string | null
          identificacion?: string
          logo_data?: string | null
          nombre_comercial?: string | null
          nombre_fiscal?: string
          organization_id?: string
          otras_senas?: string | null
          pie_reportes?: string | null
          provincia?: string | null
          sitio_web?: string | null
          sucursal?: string
          telefono?: string | null
          terminal?: string
          tipo_identificacion?: string
          updated_at?: string
        }
        Update: {
          actividad_economica?: string
          activo?: boolean
          ambiente?: string
          canton?: string | null
          correo?: string | null
          distrito?: string | null
          identificacion?: string
          logo_data?: string | null
          nombre_comercial?: string | null
          nombre_fiscal?: string
          organization_id?: string
          otras_senas?: string | null
          pie_reportes?: string | null
          provincia?: string | null
          sitio_web?: string | null
          sucursal?: string
          telefono?: string | null
          terminal?: string
          tipo_identificacion?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "config_fiscal_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      creditos: {
        Row: {
          cliente_id: string | null
          created_at: string
          estado: Database["public"]["Enums"]["estado_credito"]
          fecha: string
          fecha_limite: string | null
          id: string
          monto: number
          organization_id: string
          saldo: number
          updated_at: string
          venta_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_credito"]
          fecha?: string
          fecha_limite?: string | null
          id?: string
          monto?: number
          organization_id?: string
          saldo?: number
          updated_at?: string
          venta_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_credito"]
          fecha?: string
          fecha_limite?: string | null
          id?: string
          monto?: number
          organization_id?: string
          saldo?: number
          updated_at?: string
          venta_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creditos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creditos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creditos_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      detalle_ventas: {
        Row: {
          cantidad: number
          id: string
          modificado_en: string | null
          modificado_por: string | null
          motivo_modificacion: string | null
          nombre_producto: string
          organization_id: string
          precio_modificado: boolean
          precio_original: number | null
          precio_unitario: number
          producto_id: string | null
          total_linea: number
          venta_id: string
        }
        Insert: {
          cantidad?: number
          id?: string
          modificado_en?: string | null
          modificado_por?: string | null
          motivo_modificacion?: string | null
          nombre_producto: string
          organization_id?: string
          precio_modificado?: boolean
          precio_original?: number | null
          precio_unitario?: number
          producto_id?: string | null
          total_linea?: number
          venta_id: string
        }
        Update: {
          cantidad?: number
          id?: string
          modificado_en?: string | null
          modificado_por?: string | null
          motivo_modificacion?: string | null
          nombre_producto?: string
          organization_id?: string
          precio_modificado?: boolean
          precio_original?: number | null
          precio_unitario?: number
          producto_id?: string | null
          total_linea?: number
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "detalle_ventas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalle_ventas_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detalle_ventas_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      devoluciones: {
        Row: {
          aplicado_credito: number
          cliente_id: string | null
          created_at: string
          fecha: string
          id: string
          notas: string | null
          organization_id: string
          ruta_id: string | null
          tipo: string
          total: number
          usuario_id: string | null
        }
        Insert: {
          aplicado_credito?: number
          cliente_id?: string | null
          created_at?: string
          fecha?: string
          id?: string
          notas?: string | null
          organization_id?: string
          ruta_id?: string | null
          tipo?: string
          total?: number
          usuario_id?: string | null
        }
        Update: {
          aplicado_credito?: number
          cliente_id?: string | null
          created_at?: string
          fecha?: string
          id?: string
          notas?: string | null
          organization_id?: string
          ruta_id?: string | null
          tipo?: string
          total?: number
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devoluciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoluciones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoluciones_ruta_id_fkey"
            columns: ["ruta_id"]
            isOneToOne: false
            referencedRelation: "rutas"
            referencedColumns: ["id"]
          },
        ]
      }
      devoluciones_detalle: {
        Row: {
          cantidad: number
          destino: string
          devolucion_id: string
          id: string
          motivo: string
          nombre_producto: string
          organization_id: string
          precio_unitario: number
          producto_id: string | null
        }
        Insert: {
          cantidad: number
          destino: string
          devolucion_id: string
          id?: string
          motivo: string
          nombre_producto: string
          organization_id?: string
          precio_unitario?: number
          producto_id?: string | null
        }
        Update: {
          cantidad?: number
          destino?: string
          devolucion_id?: string
          id?: string
          motivo?: string
          nombre_producto?: string
          organization_id?: string
          precio_unitario?: number
          producto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devoluciones_detalle_devolucion_id_fkey"
            columns: ["devolucion_id"]
            isOneToOne: false
            referencedRelation: "devoluciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoluciones_detalle_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devoluciones_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      evidencias: {
        Row: {
          capturada_en: string
          created_at: string
          device_id: string
          entidad: string
          entidad_id: string
          id: string
          latitud: number | null
          longitud: number | null
          mime_type: string
          nombre_archivo: string
          organization_id: string
          sha256: string
          storage_path: string
          tamano: number
          usuario_id: string
        }
        Insert: {
          capturada_en: string
          created_at?: string
          device_id: string
          entidad: string
          entidad_id: string
          id: string
          latitud?: number | null
          longitud?: number | null
          mime_type: string
          nombre_archivo: string
          organization_id?: string
          sha256: string
          storage_path: string
          tamano: number
          usuario_id: string
        }
        Update: {
          capturada_en?: string
          created_at?: string
          device_id?: string
          entidad?: string
          entidad_id?: string
          id?: string
          latitud?: number | null
          longitud?: number | null
          mime_type?: string
          nombre_archivo?: string
          organization_id?: string
          sha256?: string
          storage_path?: string
          tamano?: number
          usuario_id?: string
        }
        Relationships: []
      }
      gastos: {
        Row: {
          categoria: string
          created_at: string
          descripcion: string | null
          fecha: string
          id: string
          monto: number
          organization_id: string
          ruta_id: string | null
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          categoria?: string
          created_at?: string
          descripcion?: string | null
          fecha?: string
          id?: string
          monto?: number
          organization_id?: string
          ruta_id?: string | null
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          categoria?: string
          created_at?: string
          descripcion?: string | null
          fecha?: string
          id?: string
          monto?: number
          organization_id?: string
          ruta_id?: string | null
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gastos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_ruta_id_fkey"
            columns: ["ruta_id"]
            isOneToOne: false
            referencedRelation: "rutas"
            referencedColumns: ["id"]
          },
        ]
      }
      listas_precios: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          fecha_fin: string | null
          fecha_inicio: string | null
          id: string
          nombre: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          nombre: string
          organization_id?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          nombre?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listas_precios_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_inventario: {
        Row: {
          cantidad: number
          fecha: string
          id: string
          motivo: string | null
          organization_id: string
          producto_id: string
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
          usuario_id: string | null
        }
        Insert: {
          cantidad?: number
          fecha?: string
          id?: string
          motivo?: string | null
          organization_id?: string
          producto_id: string
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
          usuario_id?: string | null
        }
        Update: {
          cantidad?: number
          fecha?: string
          id?: string
          motivo?: string | null
          organization_id?: string
          producto_id?: string
          tipo?: Database["public"]["Enums"]["tipo_movimiento"]
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_inventario_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_inventario_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          es_predeterminada: boolean
          estado: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          es_predeterminada?: boolean
          estado?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          es_predeterminada?: boolean
          estado?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          codigo: string
          created_at: string
          estado: string
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          codigo: string
          created_at?: string
          estado?: string
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          codigo?: string
          created_at?: string
          estado?: string
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      pedidos: {
        Row: {
          carga_id: string | null
          cliente_id: string
          created_at: string
          estado: string
          fecha_entrega: string
          id: string
          notas: string | null
          organization_id: string
          ruta_id: string | null
          total: number
          updated_at: string
          usuario_id: string | null
          venta_id: string | null
        }
        Insert: {
          carga_id?: string | null
          cliente_id: string
          created_at?: string
          estado?: string
          fecha_entrega: string
          id?: string
          notas?: string | null
          organization_id?: string
          ruta_id?: string | null
          total?: number
          updated_at?: string
          usuario_id?: string | null
          venta_id?: string | null
        }
        Update: {
          carga_id?: string | null
          cliente_id?: string
          created_at?: string
          estado?: string
          fecha_entrega?: string
          id?: string
          notas?: string | null
          organization_id?: string
          ruta_id?: string | null
          total?: number
          updated_at?: string
          usuario_id?: string | null
          venta_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas_camion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_ruta_id_fkey"
            columns: ["ruta_id"]
            isOneToOne: false
            referencedRelation: "rutas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_detalle: {
        Row: {
          cantidad: number
          id: string
          nombre_producto: string
          organization_id: string
          pedido_id: string
          precio_unitario: number
          producto_id: string
        }
        Insert: {
          cantidad: number
          id?: string
          nombre_producto: string
          organization_id?: string
          pedido_id: string
          precio_unitario: number
          producto_id: string
        }
        Update: {
          cantidad?: number
          id?: string
          nombre_producto?: string
          organization_id?: string
          pedido_id?: string
          precio_unitario?: number
          producto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_detalle_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_detalle_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_detalle_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          organizacion_activa: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          organizacion_activa?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          organizacion_activa?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_admins_organizacion_activa_fkey"
            columns: ["organizacion_activa"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      precios_especiales: {
        Row: {
          activo: boolean
          cliente_id: string
          creado_por: string | null
          created_at: string
          fecha_fin: string | null
          fecha_inicio: string
          id: string
          modificado_por: string | null
          organization_id: string
          precio: number
          producto_id: string
          ruta_id: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          cliente_id: string
          creado_por?: string | null
          created_at?: string
          fecha_fin?: string | null
          fecha_inicio?: string
          id?: string
          modificado_por?: string | null
          organization_id?: string
          precio: number
          producto_id: string
          ruta_id?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          cliente_id?: string
          creado_por?: string | null
          created_at?: string
          fecha_fin?: string | null
          fecha_inicio?: string
          id?: string
          modificado_por?: string | null
          organization_id?: string
          precio?: number
          producto_id?: string
          ruta_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "precios_especiales_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precios_especiales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precios_especiales_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precios_especiales_ruta_id_fkey"
            columns: ["ruta_id"]
            isOneToOne: false
            referencedRelation: "rutas"
            referencedColumns: ["id"]
          },
        ]
      }
      precios_productos: {
        Row: {
          id: string
          lista_id: string
          organization_id: string
          precio: number
          producto_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          lista_id: string
          organization_id?: string
          precio: number
          producto_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          lista_id?: string
          organization_id?: string
          precio?: number
          producto_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "precios_productos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "precios_productos_organization_id_lista_id_fkey"
            columns: ["organization_id", "lista_id"]
            isOneToOne: false
            referencedRelation: "listas_precios"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "precios_productos_organization_id_producto_id_fkey"
            columns: ["organization_id", "producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      productos: {
        Row: {
          activo: boolean
          cabys: string | null
          categoria_id: string | null
          codigo: string
          costo: number
          created_at: string
          existencia: number
          existencia_minima: number
          id: string
          nombre: string
          organization_id: string
          precio: number
          tarifa_iva: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          cabys?: string | null
          categoria_id?: string | null
          codigo: string
          costo?: number
          created_at?: string
          existencia?: number
          existencia_minima?: number
          id?: string
          nombre: string
          organization_id?: string
          precio?: number
          tarifa_iva?: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          cabys?: string | null
          categoria_id?: string | null
          codigo?: string
          costo?: number
          created_at?: string
          existencia?: number
          existencia_minima?: number
          id?: string
          nombre?: string
          organization_id?: string
          precio?: number
          tarifa_iva?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "productos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          nombre: string
          ruta_default: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          nombre?: string
          ruta_default?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
          ruta_default?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rutas: {
        Row: {
          created_at: string
          dia: string | null
          id: string
          lista_precio_id: string | null
          nombre: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dia?: string | null
          id?: string
          lista_precio_id?: string | null
          nombre: string
          organization_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dia?: string | null
          id?: string
          lista_precio_id?: string | null
          nombre?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rutas_lista_precio_id_fkey"
            columns: ["lista_precio_id"]
            isOneToOne: false
            referencedRelation: "listas_precios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rutas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_conflicts: {
        Row: {
          conflict_type: string
          created_at: string
          device_id: string
          entity: string
          entity_id: string
          id: string
          local_data: Json
          operation_id: string
          organization_id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          server_data: Json | null
          status: string
          user_id: string
        }
        Insert: {
          conflict_type: string
          created_at?: string
          device_id: string
          entity: string
          entity_id: string
          id?: string
          local_data: Json
          operation_id: string
          organization_id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          server_data?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          conflict_type?: string
          created_at?: string
          device_id?: string
          entity?: string
          entity_id?: string
          id?: string
          local_data?: Json
          operation_id?: string
          organization_id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          server_data?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_clientes: {
        Row: {
          activo: boolean
          chat_id: number | null
          cliente_id: string
          created_at: string
          id: string
          organization_id: string
          telegram_nombre: string | null
          vinculado_en: string | null
        }
        Insert: {
          activo?: boolean
          chat_id?: number | null
          cliente_id: string
          created_at?: string
          id?: string
          organization_id?: string
          telegram_nombre?: string | null
          vinculado_en?: string | null
        }
        Update: {
          activo?: boolean
          chat_id?: number | null
          cliente_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          telegram_nombre?: string | null
          vinculado_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_clientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_clientes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_codigos: {
        Row: {
          cliente_id: string
          consumed_at: string | null
          created_at: string
          created_by: string
          expires_at: string
          id: string
          organization_id: string
          token_hash: string
        }
        Insert: {
          cliente_id: string
          consumed_at?: string | null
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          organization_id: string
          token_hash: string
        }
        Update: {
          cliente_id?: string
          consumed_at?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          organization_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_codigos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_codigos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_mensajes: {
        Row: {
          cliente_id: string
          created_at: string
          dedupe_key: string | null
          direccion: string
          error: string | null
          estado: string
          id: string
          organization_id: string
          telegram_message_id: number | null
          telegram_update_id: number | null
          texto: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          dedupe_key?: string | null
          direccion: string
          error?: string | null
          estado?: string
          id?: string
          organization_id?: string
          telegram_message_id?: number | null
          telegram_update_id?: number | null
          texto: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          dedupe_key?: string | null
          direccion?: string
          error?: string | null
          estado?: string
          id?: string
          organization_id?: string
          telegram_message_id?: number | null
          telegram_update_id?: number | null
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_mensajes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_mensajes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_updates: {
        Row: {
          created_at: string
          update_id: number
        }
        Insert: {
          created_at?: string
          update_id: number
        }
        Update: {
          created_at?: string
          update_id?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      ventas: {
        Row: {
          carga_id: string | null
          cliente_id: string | null
          created_at: string
          descuento: number
          fecha: string
          id: string
          latitud: number | null
          longitud: number | null
          metodo_pago: Database["public"]["Enums"]["metodo_pago"]
          organization_id: string
          ruta_id: string | null
          subtotal: number
          total: number
          vendedor_id: string | null
        }
        Insert: {
          carga_id?: string | null
          cliente_id?: string | null
          created_at?: string
          descuento?: number
          fecha?: string
          id?: string
          latitud?: number | null
          longitud?: number | null
          metodo_pago?: Database["public"]["Enums"]["metodo_pago"]
          organization_id?: string
          ruta_id?: string | null
          subtotal?: number
          total?: number
          vendedor_id?: string | null
        }
        Update: {
          carga_id?: string | null
          cliente_id?: string | null
          created_at?: string
          descuento?: number
          fecha?: string
          id?: string
          latitud?: number | null
          longitud?: number | null
          metodo_pago?: Database["public"]["Enums"]["metodo_pago"]
          organization_id?: string
          ruta_id?: string | null
          subtotal?: number
          total?: number
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ventas_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas_camion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_ruta_id_fkey"
            columns: ["ruta_id"]
            isOneToOne: false
            referencedRelation: "rutas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      abrir_carga_camion: { Args: { p: Json }; Returns: string }
      anular_venta_camion: { Args: { p_venta: string }; Returns: undefined }
      cambios_desde: {
        Args: { p_desde: string }
        Returns: {
          cambios: number
          entidad: string
          ultimo: string
        }[]
      }
      cerrar_carga_camion: { Args: { p: Json }; Returns: string }
      current_organization_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_platform_admin: { Args: { _uid?: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      registrar_devolucion: { Args: { p: Json }; Returns: string }
      set_default_organization: { Args: { p_org: string }; Returns: undefined }
      telegram_recibir: {
        Args: {
          p_chat_id: number
          p_nombre: string
          p_texto: string
          p_token_hash?: string
          p_update_id: number
        }
        Returns: Json
      }
      vender_desde_camion: { Args: { p: Json }; Returns: Json }
    }
    Enums: {
      app_role: "administrador" | "vendedor" | "cobrador"
      estado_credito: "al_dia" | "vencido" | "cancelado"
      metodo_pago: "contado" | "credito"
      tipo_movimiento: "entrada" | "salida" | "ajuste"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["administrador", "vendedor", "cobrador"],
      estado_credito: ["al_dia", "vencido", "cancelado"],
      metodo_pago: ["contado", "credito"],
      tipo_movimiento: ["entrada", "salida", "ajuste"],
    },
  },
} as const
