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
  '23503': 'Esta conta tem transações. Arquive em vez de excluir.',
}

// Regras com nome (CHECK, FK ou HINT dos triggers das migrations cartao_config e faturas_compras).
// O nome aparece no texto técnico do erro; a pessoa vê só a mensagem em português.
const RULE_MESSAGES: Record<string, string> = {
  accounts_conta_pagamento_tipo_check:
    'Um cartão é pago com uma conta de dinheiro: a conta de pagamento não pode ser um cartão.',
  accounts_tipo_cartao_em_uso_check:
    'Esta conta tem transações ou faturas, por isso não pode mudar de ou para cartão de crédito.',
  // Mudar os dias de um cartão com faturas (C8, migration estornos_dias_cartao)
  accounts_cartao_dias_transicao_check:
    'Com estes dias, a fatura aberta fecharia hoje ou antes. Escolha outros dias ou espere a fatura aberta fechar.',
  accounts_cartao_dias_pagamentos_check:
    'A fatura aberta ou uma fatura futura deste cartão já tem pagamentos, por isso os dias não podem mudar agora. O limite e a conta de pagamento podem.',
  accounts_cartao_dias_compras_check:
    'Com estes dias, compras ou estornos com data futura mudariam de fatura. Escolha outros dias.',
  accounts_conta_pagamento_propria_check:
    'Um cartão não pode ser a sua própria conta de pagamento.',
  accounts_cartao_dias_check: 'Os dias de fechamento e vencimento não são válidos.',
  accounts_cartao_campos_check:
    'Falta configurar o cartão (fechamento, vencimento, limite e conta).',
  // FK da migration recorrentes (ao apagar)
  // FK da migration terceiros (ao apagar)
  reembolsos_account_fk:
    'Esta conta recebeu pagamentos de outras pessoas. Arquive em vez de excluir.',
  recorrencias_account_fk:
    'Esta conta é usada em um lançamento recorrente. Troque a conta dele ou exclua-o primeiro (Configurações → Recorrentes).',
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
        ? 'Esta conta paga a fatura de um cartão. Troque a conta de pagamento do cartão ou arquive esta conta.'
        : 'A conta de pagamento escolhida já não existe. Atualize a página e tente de novo.',
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
