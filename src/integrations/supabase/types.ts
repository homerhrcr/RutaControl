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
          created_at: string
          direccion: string | null
          distrito: string | null
          foto_url: string | null
          id: string
          latitud: number | null
          longitud: number | null
          nombre: string
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
          provincia?: string | null
          referencia?: string | null
          ruta_id?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
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
          nombre_producto: string
          organization_id: string
          precio_unitario: number
          producto_id: string | null
          total_linea: number
          venta_id: string
        }
        Insert: {
          cantidad?: number
          id?: string
          nombre_producto: string
          organization_id?: string
          precio_unitario?: number
          producto_id?: string | null
          total_linea?: number
          venta_id: string
        }
        Update: {
          cantidad?: number
          id?: string
          nombre_producto?: string
          organization_id?: string
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
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
          nombre: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          dia?: string | null
          id?: string
          nombre: string
          organization_id?: string
        }
        Update: {
          created_at?: string
          dia?: string | null
          id?: string
          nombre?: string
          organization_id?: string
        }
        Relationships: [
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
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
      cambios_desde: {
        Args: { p_desde: string }
        Returns: {
          cambios: number
          entidad: string
          ultimo: string
        }[]
      }
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
      set_default_organization: { Args: { p_org: string }; Returns: undefined }
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
