import { dbErrorMessage, UserFacingError } from '@/lib/db-errors'
import type { Tables } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

// Único ponto de acesso a cartao_dias_anteriores (C8): os dias antigos dos cartões cujos dias mudaram.
// Só se lê: as linhas são escritas pela base de dados quando os dias de um cartão com faturas mudam.

export type CardDaysRow = Pick<
  Tables<'cartao_dias_anteriores'>,
  'account_id' | 'ate_mes' | 'dia_fechamento' | 'dia_vencimento'
>

/** Todas as linhas do utilizador (poucas: uma por mudança de dias). */
export async function listCardDaysHistory(): Promise<CardDaysRow[]> {
  const { data, error } = await supabase
    .from('cartao_dias_anteriores')
    .select('account_id, ate_mes, dia_fechamento, dia_vencimento')
    .order('ate_mes')
  if (error) throw new UserFacingError(dbErrorMessage(error))
  return data
}
