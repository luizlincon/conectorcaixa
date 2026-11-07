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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      alertas: {
        Row: {
          created_at: string
          data: string
          fechamento_id: string
          id: string
          mensagem: string
          nivel: string
          observacao: string | null
          regra: number
          resolvido: boolean
          resolvido_em: string | null
          resolvido_por_nome: string | null
          unidade_id: string
        }
        Insert: {
          created_at?: string
          data: string
          fechamento_id: string
          id?: string
          mensagem: string
          nivel: string
          observacao?: string | null
          regra: number
          resolvido?: boolean
          resolvido_em?: string | null
          resolvido_por_nome?: string | null
          unidade_id: string
        }
        Update: {
          created_at?: string
          data?: string
          fechamento_id?: string
          id?: string
          mensagem?: string
          nivel?: string
          observacao?: string | null
          regra?: number
          resolvido?: boolean
          resolvido_em?: string | null
          resolvido_por_nome?: string | null
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_fechamento_id_fkey"
            columns: ["fechamento_id"]
            isOneToOne: false
            referencedRelation: "fechamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alertas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      fechamentos: {
        Row: {
          corrigido_em: string | null
          corrigido_por_nome: string | null
          created_at: string
          data: string
          enviado_em: string | null
          enviado_por: string | null
          enviado_por_nome: string | null
          id: string
          leitura_erro: string | null
          leitura_hub: Json | null
          leitura_pag: Json | null
          leitura_status: string
          status: string
          unidade_id: string
          valor_assinatura: number
          valor_dinheiro: number
          valor_maquina: number
          versoes: Json
        }
        Insert: {
          corrigido_em?: string | null
          corrigido_por_nome?: string | null
          created_at?: string
          data: string
          enviado_em?: string | null
          enviado_por?: string | null
          enviado_por_nome?: string | null
          id?: string
          leitura_erro?: string | null
          leitura_hub?: Json | null
          leitura_pag?: Json | null
          leitura_status?: string
          status?: string
          unidade_id: string
          valor_assinatura: number
          valor_dinheiro: number
          valor_maquina: number
          versoes?: Json
        }
        Update: {
          corrigido_em?: string | null
          corrigido_por_nome?: string | null
          created_at?: string
          data?: string
          enviado_em?: string | null
          enviado_por?: string | null
          enviado_por_nome?: string | null
          id?: string
          leitura_erro?: string | null
          leitura_hub?: Json | null
          leitura_pag?: Json | null
          leitura_status?: string
          status?: string
          unidade_id?: string
          valor_assinatura?: number
          valor_dinheiro?: number
          valor_maquina?: number
          versoes?: Json
        }
        Relationships: [
          {
            foreignKeyName: "fechamentos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      feriados: {
        Row: {
          data: string
          descricao: string
          id: string
        }
        Insert: {
          data: string
          descricao?: string
          id?: string
        }
        Update: {
          data?: string
          descricao?: string
          id?: string
        }
        Relationships: []
      }
      fotos: {
        Row: {
          capturada_em: string | null
          created_at: string
          fechamento_id: string
          id: string
          path: string
          tipo: string
        }
        Insert: {
          capturada_em?: string | null
          created_at?: string
          fechamento_id: string
          id?: string
          path: string
          tipo: string
        }
        Update: {
          capturada_em?: string | null
          created_at?: string
          fechamento_id?: string
          id?: string
          path?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "fotos_fechamento_id_fkey"
            columns: ["fechamento_id"]
            isOneToOne: false
            referencedRelation: "fechamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades: {
        Row: {
          ativa: boolean
          codigo: string | null
          created_at: string
          data_inicio_assinatura: string
          dias_funcionamento: number[]
          dias_ilimitado: number[]
          horario_limite: string
          id: string
          multiplo_avulso: number
          nome: string
          valor_plano: number
        }
        Insert: {
          ativa?: boolean
          codigo?: string | null
          created_at?: string
          data_inicio_assinatura?: string
          dias_funcionamento?: number[]
          dias_ilimitado?: number[]
          horario_limite?: string
          id?: string
          multiplo_avulso?: number
          nome: string
          valor_plano?: number
        }
        Update: {
          ativa?: boolean
          codigo?: string | null
          created_at?: string
          data_inicio_assinatura?: string
          dias_funcionamento?: number[]
          dias_ilimitado?: number[]
          horario_limite?: string
          id?: string
          multiplo_avulso?: number
          nome?: string
          valor_plano?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          telefone: string
          unidade_id: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id: string
          nome: string
          telefone: string
          unidade_id?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          telefone?: string
          unidade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
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
      hoje_sp: { Args: never; Returns: string }
      minha_unidade: { Args: never; Returns: string }
      unidade_por_codigo: {
        Args: { _codigo: string }
        Returns: {
          codigo: string
          id: string
          nome: string
        }[]
      }
    }
    Enums: {
      app_role: "dono" | "funcionario"
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
      app_role: ["dono", "funcionario"],
    },
  },
} as const
