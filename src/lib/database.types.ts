export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: {
          arquivada: boolean
          conta_pagamento_id: string | null
          created_at: string
          dia_fechamento: number | null
          dia_vencimento: number | null
          id: string
          limite_centavos: number | null
          nome: string
          saldo_inicial_centavos: number
          tipo: Database['public']['Enums']['tipo_conta']
          user_id: string
        }
        ComputedFields: never
        Insert: {
          arquivada?: boolean
          conta_pagamento_id?: string | null
          created_at?: string
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          id?: string
          limite_centavos?: number | null
          nome: string
          saldo_inicial_centavos?: number
          tipo?: Database['public']['Enums']['tipo_conta']
          user_id?: string
        }
        Update: {
          arquivada?: boolean
          conta_pagamento_id?: string | null
          created_at?: string
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          id?: string
          limite_centavos?: number | null
          nome?: string
          saldo_inicial_centavos?: number
          tipo?: Database['public']['Enums']['tipo_conta']
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'accounts_conta_pagamento_fk'
            columns: ['conta_pagamento_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['id', 'user_id']
          },
        ]
      }
      budgets: {
        Row: {
          category_id: string
          created_at: string
          id: string
          limite_centavos: number
          mes: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          limite_centavos: number
          mes: string
          user_id?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          limite_centavos?: number
          mes?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'budgets_category_fk'
            columns: ['category_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id', 'user_id']
          },
        ]
      }
      cartao_dias_anteriores: {
        Row: {
          account_id: string
          ate_mes: string
          created_at: string
          dia_fechamento: number
          dia_vencimento: number
          id: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          account_id: string
          ate_mes: string
          created_at?: string
          dia_fechamento: number
          dia_vencimento: number
          id?: string
          user_id?: string
        }
        Update: {
          account_id?: string
          ate_mes?: string
          created_at?: string
          dia_fechamento?: number
          dia_vencimento?: number
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'cartao_dias_anteriores_account_fk'
            columns: ['account_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['id', 'user_id']
          },
        ]
      }
      categories: {
        Row: {
          arquivada: boolean
          cor: string
          created_at: string
          icone: string
          id: string
          nome: string
          tipo: Database['public']['Enums']['tipo_movimento']
          user_id: string
        }
        ComputedFields: never
        Insert: {
          arquivada?: boolean
          cor?: string
          created_at?: string
          icone?: string
          id?: string
          nome: string
          tipo: Database['public']['Enums']['tipo_movimento']
          user_id?: string
        }
        Update: {
          arquivada?: boolean
          cor?: string
          created_at?: string
          icone?: string
          id?: string
          nome?: string
          tipo?: Database['public']['Enums']['tipo_movimento']
          user_id?: string
        }
        Relationships: []
      }
      compras_cartao: {
        Row: {
          account_id: string
          category_id: string
          created_at: string
          data_compra: string
          descricao: string
          id: string
          parcela_inicial: number
          parcelas: number
          pessoa_id: string | null
          user_id: string
          valor_total_centavos: number
        }
        ComputedFields: never
        Insert: {
          account_id: string
          category_id: string
          created_at?: string
          data_compra: string
          descricao?: string
          id?: string
          parcela_inicial?: number
          parcelas: number
          pessoa_id?: string | null
          user_id?: string
          valor_total_centavos: number
        }
        Update: {
          account_id?: string
          category_id?: string
          created_at?: string
          data_compra?: string
          descricao?: string
          id?: string
          parcela_inicial?: number
          parcelas?: number
          pessoa_id?: string | null
          user_id?: string
          valor_total_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: 'compras_cartao_account_fk'
            columns: ['account_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['id', 'user_id']
          },
          {
            foreignKeyName: 'compras_cartao_category_fk'
            columns: ['category_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id', 'user_id']
          },
          {
            foreignKeyName: 'compras_cartao_pessoa_fk'
            columns: ['pessoa_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'pessoas'
            referencedColumns: ['id', 'user_id']
          },
        ]
      }
      faturas: {
        Row: {
          account_id: string
          created_at: string
          data_fechamento: string
          data_vencimento: string
          id: string
          mes_referencia: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          account_id: string
          created_at?: string
          data_fechamento: string
          data_vencimento: string
          id?: string
          mes_referencia: string
          user_id?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          data_fechamento?: string
          data_vencimento?: string
          id?: string
          mes_referencia?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'faturas_account_fk'
            columns: ['account_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['id', 'user_id']
          },
        ]
      }
      pessoas: {
        Row: {
          arquivada: boolean
          created_at: string
          divida_anterior_centavos: number
          id: string
          nome: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          arquivada?: boolean
          created_at?: string
          divida_anterior_centavos?: number
          id?: string
          nome: string
          user_id?: string
        }
        Update: {
          arquivada?: boolean
          created_at?: string
          divida_anterior_centavos?: number
          id?: string
          nome?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          moeda: string
          nome: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id: string
          moeda?: string
          nome?: string
        }
        Update: {
          created_at?: string
          id?: string
          moeda?: string
          nome?: string
        }
        Relationships: []
      }
      recorrencias: {
        Row: {
          account_id: string
          ativa: boolean
          category_id: string
          created_at: string
          descricao: string
          dia: number
          falha: string | null
          falha_data: string | null
          frequencia: string
          id: string
          proxima_data: string
          tipo: Database['public']['Enums']['tipo_movimento']
          user_id: string
          valor_centavos: number
        }
        ComputedFields: never
        Insert: {
          account_id: string
          ativa?: boolean
          category_id: string
          created_at?: string
          descricao: string
          dia: number
          falha?: string | null
          falha_data?: string | null
          frequencia: string
          id?: string
          proxima_data: string
          tipo: Database['public']['Enums']['tipo_movimento']
          user_id?: string
          valor_centavos: number
        }
        Update: {
          account_id?: string
          ativa?: boolean
          category_id?: string
          created_at?: string
          descricao?: string
          dia?: number
          falha?: string | null
          falha_data?: string | null
          frequencia?: string
          id?: string
          proxima_data?: string
          tipo?: Database['public']['Enums']['tipo_movimento']
          user_id?: string
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: 'recorrencias_account_fk'
            columns: ['account_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['id', 'user_id']
          },
          {
            foreignKeyName: 'recorrencias_category_fk'
            columns: ['category_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id', 'user_id']
          },
        ]
      }
      reembolsos: {
        Row: {
          account_id: string
          created_at: string
          data: string
          descricao: string
          id: string
          pessoa_id: string
          user_id: string
          valor_centavos: number
        }
        ComputedFields: never
        Insert: {
          account_id: string
          created_at?: string
          data: string
          descricao?: string
          id?: string
          pessoa_id: string
          user_id?: string
          valor_centavos: number
        }
        Update: {
          account_id?: string
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          pessoa_id?: string
          user_id?: string
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: 'reembolsos_account_fk'
            columns: ['account_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['id', 'user_id']
          },
          {
            foreignKeyName: 'reembolsos_pessoa_fk'
            columns: ['pessoa_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'pessoas'
            referencedColumns: ['id', 'user_id']
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          category_id: string
          compra_id: string | null
          created_at: string
          data: string
          descricao: string
          fatura_id: string | null
          id: string
          parcela_numero: number | null
          pessoa_id: string | null
          recorrencia_id: string | null
          tipo: Database['public']['Enums']['tipo_movimento']
          user_id: string
          valor_centavos: number
        }
        ComputedFields: never
        Insert: {
          account_id: string
          category_id: string
          compra_id?: string | null
          created_at?: string
          data?: string
          descricao?: string
          fatura_id?: string | null
          id?: string
          parcela_numero?: number | null
          pessoa_id?: string | null
          recorrencia_id?: string | null
          tipo: Database['public']['Enums']['tipo_movimento']
          user_id?: string
          valor_centavos: number
        }
        Update: {
          account_id?: string
          category_id?: string
          compra_id?: string | null
          created_at?: string
          data?: string
          descricao?: string
          fatura_id?: string | null
          id?: string
          parcela_numero?: number | null
          pessoa_id?: string | null
          recorrencia_id?: string | null
          tipo?: Database['public']['Enums']['tipo_movimento']
          user_id?: string
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: 'transactions_account_fk'
            columns: ['account_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['id', 'user_id']
          },
          {
            foreignKeyName: 'transactions_category_fk'
            columns: ['category_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id', 'user_id']
          },
          {
            foreignKeyName: 'transactions_compra_fk'
            columns: ['compra_id', 'account_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'compras_cartao'
            referencedColumns: ['id', 'account_id', 'user_id']
          },
          {
            foreignKeyName: 'transactions_fatura_fk'
            columns: ['fatura_id', 'account_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'faturas'
            referencedColumns: ['id', 'account_id', 'user_id']
          },
          {
            foreignKeyName: 'transactions_pessoa_fk'
            columns: ['pessoa_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'pessoas'
            referencedColumns: ['id', 'user_id']
          },
          {
            foreignKeyName: 'transactions_recorrencia_fk'
            columns: ['recorrencia_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'recorrencias'
            referencedColumns: ['id', 'user_id']
          },
        ]
      }
      transferencias: {
        Row: {
          conta_destino_id: string
          conta_origem_id: string
          created_at: string
          data: string
          descricao: string
          fatura_id: string | null
          id: string
          user_id: string
          valor_centavos: number
        }
        ComputedFields: never
        Insert: {
          conta_destino_id: string
          conta_origem_id: string
          created_at?: string
          data?: string
          descricao?: string
          fatura_id?: string | null
          id?: string
          user_id?: string
          valor_centavos: number
        }
        Update: {
          conta_destino_id?: string
          conta_origem_id?: string
          created_at?: string
          data?: string
          descricao?: string
          fatura_id?: string | null
          id?: string
          user_id?: string
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: 'transferencias_destino_fk'
            columns: ['conta_destino_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['id', 'user_id']
          },
          {
            foreignKeyName: 'transferencias_fatura_fk'
            columns: ['fatura_id', 'conta_destino_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'faturas'
            referencedColumns: ['id', 'account_id', 'user_id']
          },
          {
            foreignKeyName: 'transferencias_origem_fk'
            columns: ['conta_origem_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['id', 'user_id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cartao_data_parcela: { Args: { data_compra: string; numero: number }; Returns: string }
      cartao_datas_fatura: {
        Args: { dia_fechamento: number; dia_vencimento: number; mes_referencia: string }
        Returns: Record<string, unknown>
      }
      cartao_datas_fatura_conta: {
        Args: { p_account_id: string; p_mes: string }
        Returns: Record<string, unknown>
      }
      cartao_datas_fatura_hist: {
        Args: {
          p_account_id: string
          p_dia_fechamento: number
          p_dia_vencimento: number
          p_mes: string
        }
        Returns: Record<string, unknown>
      }
      cartao_dia_no_mes: { Args: { dia: number; mes: string }; Returns: string }
      cartao_fatura_da_compra: {
        Args: { data_compra: string; dia_fechamento: number; dia_vencimento: number }
        Returns: string
      }
      cartao_fatura_da_compra_conta: {
        Args: { p_account_id: string; p_data: string }
        Returns: string
      }
      cartao_fatura_da_data_hist: {
        Args: {
          p_account_id: string
          p_data: string
          p_dia_fechamento: number
          p_dia_vencimento: number
        }
        Returns: string
      }
      cartao_valor_parcela: {
        Args: { numero: number; parcelas: number; total: number }
        Returns: number
      }
      gerar_recorrencias: { Args: { p_hoje: string }; Returns: number }
      recorrencia_seguinte: {
        Args: { p_data: string; p_dia: number; p_frequencia: string }
        Returns: string
      }
      registar_compra_cartao: {
        Args: {
          p_account_id: string
          p_category_id: string
          p_data_compra: string
          p_descricao?: string
          p_parcela_inicial?: number
          p_parcelas: number
          p_pessoa_id?: string
          p_valor_total_centavos: number
        }
        Returns: string
      }
      registar_estorno_cartao: {
        Args: {
          p_compra_id: string
          p_data: string
          p_descricao?: string
          p_valor_centavos: number
        }
        Returns: string
      }
    }
    Enums: {
      tipo_conta: 'corrente' | 'poupanca' | 'dinheiro' | 'investimento' | 'outra' | 'cartao_credito'
      tipo_movimento: 'receita' | 'despesa' | 'estorno'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      tipo_conta: ['corrente', 'poupanca', 'dinheiro', 'investimento', 'outra', 'cartao_credito'],
      tipo_movimento: ['receita', 'despesa', 'estorno'],
    },
  },
} as const
