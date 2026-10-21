import type { TipoCategoria } from '@/features/categories/categories-api'
import { dbErrorMessage, UserFacingError } from '@/lib/db-errors'
import type { Tables } from '@/lib/database.types'
import type { IsoDate } from '@/lib/dates'
import type { Frequency } from '@/lib/recurrence'
import { supabase } from '@/lib/supabase'

// Único ponto de acesso à tabela recorrencias (migration recorrentes). A RLS garante no servidor que só
// vemos/alteramos as nossas; as regras (categoria do tipo certo, cartão só com despesas, próxima data
// não passada) estão na base de dados. Os lançamentos são criados por gerar_recorrencias (generate-api).

/** O CHECK recorrencias_tipo_check só aceita receita e despesa; o de frequência, mensal e anual. */
export type Recurring = Omit<Tables<'recorrencias'>, 'tipo' | 'frequencia'> & {
  tipo: TipoCategoria
  frequencia: Frequency
}

export type RecurringValues = {
  tipo: TipoCategoria
  valorCentavos: number
  descricao: string
  accountId: string
  categoryId: string
  frequencia: Frequency
  proximaData: IsoDate
  /** Dia pedido (1–31); normalmente o dia da próxima data */
  dia: number
}

export type RecurringPatch = Partial<
  Pick<
    Recurring,
    | 'account_id'
    | 'category_id'
    | 'tipo'
    | 'valor_centavos'
    | 'descricao'
    | 'frequencia'
    | 'dia'
    | 'proxima_data'
    | 'ativa'
    | 'falha'
    | 'falha_data'
  >
>

const MESSAGES = {
  '23503': 'A conta ou a categoria escolhida já não existe. Atualize a página e tente de novo.',
  '23514': 'Há um valor inválido (confira o valor, o nome e a data).',
}

// Regras com nome (CHECK ou HINT da trigger): mensagem própria. O nome aparece no texto técnico.
const RULE_MESSAGES: Record<string, string> = {
  recorrencias_categoria_check: 'Escolha uma categoria do mesmo tipo do lançamento.',
  recorrencias_cartao_check: 'Em um cartão de crédito só há despesas.',
  recorrencias_data_check: 'A próxima data não pode ser no passado.',
  recorrencias_dia_check: 'A próxima data não é válida.',
  recorrencias_descricao_check: 'Informe um nome com até 120 caracteres.',
  recorrencias_valor_check: 'O valor precisa ser maior que zero.',
}

type DbError = { code?: string; message?: string; details?: string; hint?: string }

function fail(error: DbError): never {
  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`
  const rule = Object.keys(RULE_MESSAGES).find((name) => text.includes(name))
  throw new UserFacingError(rule ? RULE_MESSAGES[rule] : dbErrorMessage(error, MESSAGES))
}

/** Valores do formulário → colunas. */
export function recurringRow(values: RecurringValues) {
  return {
    account_id: values.accountId,
    category_id: values.categoryId,
    tipo: values.tipo,
    valor_centavos: values.valorCentavos,
    descricao: values.descricao,
    frequencia: values.frequencia,
    dia: values.dia,
    proxima_data: values.proximaData,
  } satisfies RecurringPatch
}

/** Por próxima data (as pausadas no fim, na página); poucas linhas, sem paginação. */
export async function listRecurring(): Promise<Recurring[]> {
  const { data, error } = await supabase
    .from('recorrencias')
    .select('*')
    .order('proxima_data')
    .order('id')
  if (error) fail(error)
  return data as Recurring[]
}

export async function createRecurring(values: RecurringValues): Promise<Recurring> {
  const { data, error } = await supabase
    .from('recorrencias')
    .insert(recurringRow(values))
    .select()
    .single()
  if (error) fail(error)
  return data as Recurring
}

export async function updateRecurring(id: string, patch: RecurringPatch): Promise<Recurring> {
  const { data, error } = await supabase
    .from('recorrencias')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) fail(error)
  return data as Recurring
}

/** Os lançamentos já criados ficam (a ligação passa a null). */
export async function deleteRecurring(id: string): Promise<void> {
  const { error } = await supabase.from('recorrencias').delete().eq('id', id)
  if (error) fail(error)
}
