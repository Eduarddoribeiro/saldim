import { dbErrorMessage, UserFacingError } from '@/lib/db-errors'
import type { Tables } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import type { AccountFormValues } from './schemas'

// Único ponto de acesso à tabela accounts. A RLS garante no servidor que só vemos/alteramos as nossas.

export type Account = Tables<'accounts'>
export type AccountPatch = Partial<
  Pick<
    Account,
    | 'nome'
    | 'tipo'
    | 'saldo_inicial_centavos'
    | 'arquivada'
    | 'dia_fechamento'
    | 'dia_vencimento'
    | 'limite_centavos'
    | 'conta_pagamento_id'
  >
>

const MESSAGES = {
  '23505': 'Já existe uma conta com esse nome.',
  '23503': 'Esta conta tem transações. Arquiva-a em vez de a apagar.',
}

// Regras com nome (CHECK, FK ou HINT dos triggers das migrations cartao_config e faturas_compras).
// O nome aparece no texto técnico do erro; a pessoa vê só a mensagem em português.
const RULE_MESSAGES: Record<string, string> = {
  accounts_conta_pagamento_tipo_check:
    'Um cartão paga-se com uma conta de dinheiro: a conta de pagamento não pode ser um cartão.',
  accounts_tipo_cartao_em_uso_check:
    'Esta conta tem transações ou faturas, por isso não pode mudar de ou para cartão de crédito.',
  // Até à etapa C8 (migration faturas_compras)
  accounts_cartao_dias_em_uso_check:
    'Este cartão já tem faturas: os dias de fechamento e vencimento ainda não podem ser alterados. O limite e a conta de pagamento podem.',
  accounts_conta_pagamento_propria_check:
    'Um cartão não pode ser a sua própria conta de pagamento.',
  accounts_cartao_dias_check: 'Os dias de fechamento e vencimento não são válidos.',
  accounts_cartao_campos_check:
    'Falta configurar o cartão (fechamento, vencimento, limite e conta).',
}

type DbError = { code?: string; message?: string; details?: string; hint?: string }

function ruleOf(error: DbError): string | undefined {
  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`
  return [...Object.keys(RULE_MESSAGES), 'accounts_conta_pagamento_fk'].find((rule) =>
    text.includes(rule),
  )
}

function fail(error: DbError, onDelete = false): never {
  const rule = ruleOf(error)
  if (rule === 'accounts_conta_pagamento_fk') {
    throw new UserFacingError(
      onDelete
        ? 'Esta conta paga a fatura de um cartão. Muda a conta de pagamento do cartão ou arquiva-a.'
        : 'A conta de pagamento escolhida já não existe. Atualiza a página e tenta de novo.',
    )
  }
  throw new UserFacingError(rule ? RULE_MESSAGES[rule] : dbErrorMessage(error, MESSAGES))
}

export function sortAccounts(accounts: Account[]): Account[] {
  return [...accounts].sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }))
}

/** Valores do formulário → colunas. Uma conta que não é cartão fica com os campos do cartão a null. */
export function accountRow({ nome, tipo, saldoInicial, cartao }: AccountFormValues) {
  return {
    nome,
    tipo,
    saldo_inicial_centavos: saldoInicial,
    dia_fechamento: cartao?.diaFechamento ?? null,
    dia_vencimento: cartao?.diaVencimento ?? null,
    limite_centavos: cartao?.limiteCentavos ?? null,
    conta_pagamento_id: cartao?.contaPagamentoId ?? null,
  } satisfies AccountPatch
}

export async function listAccounts(): Promise<Account[]> {
  const { data, error } = await supabase.from('accounts').select('*')
  if (error) fail(error)
  return sortAccounts(data)
}

export async function createAccount(values: AccountFormValues): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .insert(accountRow(values))
    .select()
    .single()
  if (error) fail(error)
  return data
}

export async function updateAccount(id: string, patch: AccountPatch): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) fail(error)
  return data
}

export async function deleteAccount(id: string): Promise<void> {
  const { error } = await supabase.from('accounts').delete().eq('id', id)
  if (error) fail(error, true)
}
