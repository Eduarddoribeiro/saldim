import { monthRange, type MonthKey } from '@/lib/dates'
import { dbErrorMessage, UserFacingError } from '@/lib/db-errors'
import type { Tables } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import type { TransactionFormValues } from './schemas'

// Único ponto de acesso à tabela transactions. A RLS e as FKs compostas protegem no servidor.

export type Transaction = Tables<'transactions'>

const MESSAGES = {
  '23503': 'A conta ou a categoria escolhida já não existe. Atualiza a página e tenta de novo.',
  '23514': 'Há um valor inválido (confirma o valor, a data e se a categoria é do tipo certo).',
}

function fail(error: { code?: string; message?: string }): never {
  throw new UserFacingError(dbErrorMessage(error, MESSAGES))
}

function toRow(values: TransactionFormValues) {
  return {
    tipo: values.tipo,
    valor_centavos: values.valor,
    data: values.data,
    category_id: values.categoryId,
    account_id: values.accountId,
    descricao: values.descricao,
  }
}

/** Transações do mês (data >= dia 1 e < dia 1 do mês seguinte), mais recentes primeiro. */
export async function listTransactions(month: MonthKey): Promise<Transaction[]> {
  const { from, to } = monthRange(month)
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .gte('data', from)
    .lt('data', to)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) fail(error)
  return data
}

export async function createTransaction(values: TransactionFormValues): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .insert(toRow(values))
    .select()
    .single()
  if (error) fail(error)
  return data
}

export async function updateTransaction(
  id: string,
  values: TransactionFormValues,
): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .update(toRow(values))
    .eq('id', id)
    .select()
    .single()
  if (error) fail(error)
  return data
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) fail(error)
}
