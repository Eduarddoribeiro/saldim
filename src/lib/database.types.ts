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
      cartao_dia_no_mes: { Args: { dia: number; mes: string }; Returns: string }
      cartao_fatura_da_compra: {
        Args: { data_compra: string; dia_fechamento: number; dia_vencimento: number }
        Returns: string
      }
      cartao_valor_parcela: {
        Args: { numero: number; parcelas: number; total: number }
        Returns: number
      }
      registar_compra_cartao: {
        Args: {
          p_account_id: string
          p_category_id: string
          p_data_compra: string
          p_descricao?: string
          p_parcela_inicial?: number
          p_parcelas: number
          p_valor_total_centavos: number
        }
        Returns: string
      }
    }
    Enums: {
      tipo_conta: 'corrente' | 'poupanca' | 'dinheiro' | 'investimento' | 'outra' | 'cartao_credito'
      tipo_movimento: 'receita' | 'despesa'
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
      tipo_movimento: ['receita', 'despesa'],
    },
  },
} as const
