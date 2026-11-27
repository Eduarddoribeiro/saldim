import { dbErrorMessage, UserFacingError } from '@/lib/db-errors'
import type { IsoDate } from '@/lib/dates'
import { fetchAllPages } from '@/lib/pagination'
import { supabase } from '@/lib/supabase'

// Único ponto de acesso à tabela dias_fechados (migration dias_fechados).

const MESSAGES = { '23514': 'Só dá para fechar o dia de hoje.' }

/** Os dias fechados, do mais antigo ao mais recente. */
export async function listClosedDays(): Promise<IsoDate[]> {
  const { data, error } = await fetchAllPages((start, end) =>
    supabase.from('dias_fechados').select('dia').order('dia').order('id').range(start, end),
  )
  if (error) throw new UserFacingError(dbErrorMessage(error, MESSAGES))
  return data.map((row) => row.dia)
}

/** Fecha o dia (hoje). Fechar de novo o mesmo dia não faz nada. */
export async function closeDay(dia: IsoDate): Promise<void> {
  const { error } = await supabase
    .from('dias_fechados')
    .upsert({ dia }, { onConflict: 'user_id,dia', ignoreDuplicates: true })
  if (error) throw new UserFacingError(dbErrorMessage(error, MESSAGES))
}
