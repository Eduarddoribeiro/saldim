import { dbErrorMessage, UserFacingError } from '@/lib/db-errors'
import type { Tables } from '@/lib/database.types'
import { fetchAllPages } from '@/lib/pagination'
import { supabase } from '@/lib/supabase'

// Único ponto de acesso à tabela faturas. As faturas são criadas pela função registar_compra_cartao
// (com as datas calculadas no servidor); aqui só se leem. O estado nunca é guardado: é calculado.

export type Invoice = Pick<
  Tables<'faturas'>,
  'id' | 'account_id' | 'mes_referencia' | 'data_fechamento' | 'data_vencimento'
>

export async function listInvoices(): Promise<Invoice[]> {
  const { data, error } = await fetchAllPages((start, end) =>
    supabase
      .from('faturas')
      .select('id, account_id, mes_referencia, data_fechamento, data_vencimento')
      .order('mes_referencia')
      .order('id')
      .range(start, end),
  )
  if (error) throw new UserFacingError(dbErrorMessage(error))
  return data
}
