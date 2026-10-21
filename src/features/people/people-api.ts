import { dbErrorMessage, UserFacingError } from '@/lib/db-errors'
import type { Tables } from '@/lib/database.types'
import type { IsoDate } from '@/lib/dates'
import { fetchAllPages } from '@/lib/pagination'
import { supabase } from '@/lib/supabase'

// Único ponto de acesso às tabelas pessoas e reembolsos (migration terceiros; D19–D22). A RLS e as
// regras (reembolso numa conta de dinheiro, sem data futura) estão na base de dados.

export type Person = Tables<'pessoas'>
export type PersonPatch = Partial<Pick<Person, 'nome' | 'arquivada' | 'divida_anterior_centavos'>>
export type Reimbursement = Tables<'reembolsos'>

export type ReimbursementValues = {
  pessoaId: string
  accountId: string
  valor: number
  data: IsoDate
  descricao: string
}

const MESSAGES = {
  '23505': 'Já existe uma pessoa com esse nome.',
  '23514': 'Há um valor inválido (confira o nome, o valor e a data).',
}

// Regras com nome (FK ou HINT das triggers): mensagem própria. O nome aparece no texto técnico.
const RULE_MESSAGES: Record<string, string> = {
  compras_cartao_pessoa_fk:
    'Esta pessoa tem compras registradas. Arquive em vez de excluir (o histórico dela é mantido).',
  reembolsos_pessoa_fk:
    'Esta pessoa tem pagamentos registrados. Arquive em vez de excluir (o histórico dela é mantido).',
  transactions_pessoa_fk:
    'Esta pessoa tem compras registradas. Arquive em vez de excluir (o histórico dela é mantido).',
  reembolsos_conta_check: 'O dinheiro devolvido entra em uma conta de dinheiro, não em um cartão.',
  reembolsos_futuro_check: 'Um pagamento recebido não pode ter data futura.',
  reembolsos_account_fk: 'A conta escolhida já não existe. Atualize a página e tente de novo.',
  pessoas_nome_check: 'Informe um nome com até 60 caracteres.',
  pessoas_divida_anterior_check: 'A dívida anterior não é válida.',
}

type DbError = { code?: string; message?: string; details?: string; hint?: string }

function fail(error: DbError): never {
  const text = `${error.message ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`
  const rule = Object.keys(RULE_MESSAGES).find((name) => text.includes(name))
  throw new UserFacingError(rule ? RULE_MESSAGES[rule] : dbErrorMessage(error, MESSAGES))
}

export function sortPeople(people: Person[]): Person[] {
  return [...people].sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }))
}

export async function listPeople(): Promise<Person[]> {
  const { data, error } = await supabase.from('pessoas').select('*')
  if (error) fail(error)
  return sortPeople(data)
}

/** `dividaAnterior` (D23): o que a pessoa já devia antes de as compras dela estarem na app. */
export async function createPerson(nome: string, dividaAnterior = 0): Promise<Person> {
  const { data, error } = await supabase
    .from('pessoas')
    .insert({ nome, divida_anterior_centavos: dividaAnterior })
    .select()
    .single()
  if (error) fail(error)
  return data
}

export async function updatePerson(id: string, patch: PersonPatch): Promise<Person> {
  const { data, error } = await supabase
    .from('pessoas')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) fail(error)
  return data
}

export async function deletePerson(id: string): Promise<void> {
  const { error } = await supabase.from('pessoas').delete().eq('id', id)
  if (error) fail(error)
}

/** Todos os reembolsos (para os saldos do Início e o que cada pessoa deve), paginado. */
export async function listReimbursements(): Promise<Reimbursement[]> {
  const { data, error } = await fetchAllPages((start, end) =>
    supabase.from('reembolsos').select('*').order('data').order('id').range(start, end),
  )
  if (error) fail(error)
  return data
}

export async function createReimbursement(values: ReimbursementValues): Promise<Reimbursement> {
  const { data, error } = await supabase
    .from('reembolsos')
    .insert({
      pessoa_id: values.pessoaId,
      account_id: values.accountId,
      valor_centavos: values.valor,
      data: values.data,
      descricao: values.descricao,
    })
    .select()
    .single()
  if (error) fail(error)
  return data
}

/** Sem alterações: um reembolso errado apaga-se e regista-se de novo. */
export async function deleteReimbursement(id: string): Promise<void> {
  const { error } = await supabase.from('reembolsos').delete().eq('id', id)
  if (error) fail(error)
}
