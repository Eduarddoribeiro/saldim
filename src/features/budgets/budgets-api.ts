import type { MonthKey } from '@/lib/dates'
import { dbErrorMessage, UserFacingError } from '@/lib/db-errors'
import type { Tables } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

// Único ponto de acesso à tabela budgets. RLS + FK composta protegem no servidor.

export type Budget = Tables<'budgets'>

const MESSAGES = {
  '23505': 'Esta categoria já tem orçamento neste mês.',
  '23514': 'O limite precisa ser maior que zero e a categoria precisa ser de despesa.',
  '23503': 'A categoria já não existe. Atualize a página.',
}

function fail(error: { code?: string; message?: string }): never {
  throw new UserFacingError(dbErrorMessage(error, MESSAGES))
}

/** Os orçamentos guardam o mês como o seu dia 1 ('2026-10' → '2026-10-01'). */
export const monthToDate = (month: MonthKey) => `${month}-01`

export async function listBudgets(month: MonthKey): Promise<Budget[]> {
  const { data, error } = await supabase.from('budgets').select('*').eq('mes', monthToDate(month))
  if (error) fail(error)
  return data
}

export async function createBudget(input: {
  categoryId: string
  month: MonthKey
  limite: number
}): Promise<Budget> {
  const { data, error } = await supabase
    .from('budgets')
    .insert({
      category_id: input.categoryId,
      mes: monthToDate(input.month),
      limite_centavos: input.limite,
    })
    .select()
    .single()
  if (error) fail(error)
  return data
}

export async function updateBudget(id: string, limite: number): Promise<Budget> {
  const { data, error } = await supabase
    .from('budgets')
    .update({ limite_centavos: limite })
    .eq('id', id)
    .select()
    .single()
  if (error) fail(error)
  return data
}

export async function deleteBudget(id: string): Promise<void> {
  const { error } = await supabase.from('budgets').delete().eq('id', id)
  if (error) fail(error)
}

/**
 * Copia os orçamentos de `from` para `to`, só para categorias que ainda não têm orçamento em `to`
 * (ON CONFLICT DO NOTHING: nunca substitui um limite já definido). Devolve quantos foram criados.
 */
export async function copyBudgets(from: MonthKey, to: MonthKey): Promise<number> {
  const source = await listBudgets(from)
  if (source.length === 0) return 0
  const { data, error } = await supabase
    .from('budgets')
    .upsert(
      source.map((budget) => ({
        category_id: budget.category_id,
        mes: monthToDate(to),
        limite_centavos: budget.limite_centavos,
      })),
      { onConflict: 'user_id,category_id,mes', ignoreDuplicates: true },
    )
    .select('id')
  if (error) fail(error)
  return data.length
}
