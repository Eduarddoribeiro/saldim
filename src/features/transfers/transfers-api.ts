import { dbErrorMessage, UserFacingError } from '@/lib/db-errors'
import type { Tables } from '@/lib/database.types'
import type { Transfer } from '@/lib/finance'
import { fetchAllPages } from '@/lib/pagination'
import { supabase } from '@/lib/supabase'

// Único ponto de acesso à tabela transferencias (migration transferencias). O pagamento de uma
// fatura é uma transferência para o cartão com fatura_id; as regras e a RLS estão na base de dados.

export type InvoicePayment = Pick<
  Tables<'transferencias'>,
  'id' | 'fatura_id' | 'conta_origem_id' | 'valor_centavos' | 'data' | 'descricao'
>

export type PaymentValues = {
  faturaId: string
  cartaoId: string
  contaOrigemId: string
  valor: number
  data: string
  descricao: string
}

const MESSAGES = {
  '23503': 'A conta ou a fatura já não existe. Atualiza a página e tenta de novo.',
  '23514': 'Há um valor inválido (confirma o valor e a data).',
}

// Regras com nome (HINT da trigger check_transferencia): mensagem própria.
const RULE_MESSAGES: Record<string, string> = {
  transferencias_origem_cartao_check: 'O pagamento tem de sair de uma conta de dinheiro.',
  transferencias_cartao_sem_fatura_check: 'Um pagamento ao cartão tem de indicar a fatura.',
  transferencias_pagamento_futuro_check: 'Um pagamento não pode ter data futura.',
  transferencias_contas_diferentes_check: 'A conta de origem e a de destino têm de ser diferentes.',
}

type DbError = { code?: string; message?: string; details?: string; hint?: string }

function fail(error: DbError): never {
  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`
  const rule = Object.keys(RULE_MESSAGES).find((name) => text.includes(name))
  throw new UserFacingError(rule ? RULE_MESSAGES[rule] : dbErrorMessage(error, MESSAGES))
}

/** TODAS as transferências (só as colunas dos saldos), para o Início. Paginado com ordem total. */
export async function listTransfers(): Promise<Transfer[]> {
  const { data, error } = await fetchAllPages((start, end) =>
    supabase
      .from('transferencias')
      .select('conta_origem_id, conta_destino_id, valor_centavos, data')
      .order('data')
      .order('id')
      .range(start, end),
  )
  if (error) fail(error)
  return data
}

/** Pagamentos de faturas (transferências com fatura). */
export async function listInvoicePayments(): Promise<InvoicePayment[]> {
  const { data, error } = await fetchAllPages((start, end) =>
    supabase
      .from('transferencias')
      .select('id, fatura_id, conta_origem_id, valor_centavos, data, descricao')
      .not('fatura_id', 'is', null)
      .order('data')
      .order('id')
      .range(start, end),
  )
  if (error) fail(error)
  return data
}

/** Paga (total ou parcialmente) uma fatura: transferência da conta de origem para o cartão. */
export async function createPayment(values: PaymentValues): Promise<void> {
  const { error } = await supabase.from('transferencias').insert({
    conta_origem_id: values.contaOrigemId,
    conta_destino_id: values.cartaoId,
    fatura_id: values.faturaId,
    valor_centavos: values.valor,
    data: values.data,
    descricao: values.descricao,
  })
  if (error) fail(error)
}

/** Apaga um pagamento (a forma de corrigir um pagamento registado por engano). */
export async function deletePayment(id: string): Promise<void> {
  const { error } = await supabase.from('transferencias').delete().eq('id', id)
  if (error) fail(error)
}
