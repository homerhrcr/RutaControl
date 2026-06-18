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
        }
        Insert: {
          cliente_id?: string | null
          cobrador_id?: string | null
          created_at?: string
          credito_id: string
          fecha?: string
          id?: string
          monto?: number
        }
        Update: {
          cliente_id?: string | null
          cobrador_id?: string | null
          created_at?: string
          credito_id?: string
          fecha?: string
          id?: string
          monto?: number
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
        ]
      }
      auditoria: {
        Row: {
          accion: string
          detalle: Json | null
          entidad: string | null
          fecha: string
          id: string
          usuario_id: string | null
        }
        Insert: {
          accion: string
          detalle?: Json | null
          entidad?: string | null
          fecha?: string
          id?: string
          usuario_id?: string | null
        }
        Update: {
          accion?: string
          detalle?: Json | null
          entidad?: string | null
          fecha?: string
          id?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      categorias: {
        Row: {
          created_at: string
          id: string
          nombre: string
        }
        Insert: {
          created_at?: string
          id?: string
          nombre: string
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      cliente_rutas: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          ruta_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          ruta_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
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
          created_at: string
          direccion: string | null
          distrito: string | null
          foto_url: string | null
          id: string
          latitud: number | null
          longitud: number | null
          nombre: string
          provincia: string | null
          referencia: string | null
          ruta_id: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          canton?: string | null
          created_at?: string
          direccion?: string | null
          distrito?: string | null
          foto_url?: string | null
          id?: string
          latitud?: number | null
          longitud?: number | null
          nombre: string
          provincia?: string | null
          referencia?: string | null
          ruta_id?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          canton?: string | null
          created_at?: string
          direccion?: string | null
          distrito?: string | null
          foto_url?: string | null
          id?: string
          latitud?: number | null
          longitud?: number | null
          nombre?: string
          provincia?: string | null
          referencia?: string | null
          ruta_id?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_ruta_id_fkey"
            columns: ["ruta_id"]
            isOneToOne: false
            referencedRelation: "rutas"
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
          nombre_producto: string
          precio_unitario: number
          producto_id: string | null
          total_linea: number
          venta_id: string
        }
        Insert: {
          cantidad?: number
          id?: string
          nombre_producto: string
          precio_unitario?: number
          producto_id?: string | null
          total_linea?: number
          venta_id: string
        }
        Update: {
          cantidad?: number
          id?: string
          nombre_producto?: string
          precio_unitario?: number
          producto_id?: string | null
          total_linea?: number
          venta_id?: string
        }
        Relationships: [
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
      movimientos_inventario: {
        Row: {
          cantidad: number
          fecha: string
          id: string
          motivo: string | null
          producto_id: string
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
          usuario_id: string | null
        }
        Insert: {
          cantidad?: number
          fecha?: string
          id?: string
          motivo?: string | null
          producto_id: string
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
          usuario_id?: string | null
        }
        Update: {
          cantidad?: number
          fecha?: string
          id?: string
          motivo?: string | null
          producto_id?: string
          tipo?: Database["public"]["Enums"]["tipo_movimiento"]
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_inventario_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          activo: boolean
          categoria_id: string | null
          codigo: string
          costo: number
          created_at: string
          existencia: number
          existencia_minima: number
          id: string
          nombre: string
          precio: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          categoria_id?: string | null
          codigo: string
          costo?: number
          created_at?: string
          existencia?: number
          existencia_minima?: number
          id?: string
          nombre: string
          precio?: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          categoria_id?: string | null
          codigo?: string
          costo?: number
          created_at?: string
          existencia?: number
          existencia_minima?: number
          id?: string
          nombre?: string
          precio?: number
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
          nombre: string
        }
        Insert: {
          created_at?: string
          dia?: string | null
          id?: string
          nombre: string
        }
        Update: {
          created_at?: string
          dia?: string | null
          id?: string
          nombre?: string
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
          cliente_id: string | null
          created_at: string
          descuento: number
          fecha: string
          id: string
          latitud: number | null
          longitud: number | null
          metodo_pago: Database["public"]["Enums"]["metodo_pago"]
          ruta_id: string | null
          subtotal: number
          total: number
          vendedor_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          descuento?: number
          fecha?: string
          id?: string
          latitud?: number | null
          longitud?: number | null
          metodo_pago?: Database["public"]["Enums"]["metodo_pago"]
          ruta_id?: string | null
          subtotal?: number
          total?: number
          vendedor_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          descuento?: number
          fecha?: string
          id?: string
          latitud?: number | null
          longitud?: number | null
          metodo_pago?: Database["public"]["Enums"]["metodo_pago"]
          ruta_id?: string | null
          subtotal?: number
          total?: number
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ventas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
