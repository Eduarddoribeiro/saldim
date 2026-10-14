import { dbErrorMessage, UserFacingError } from '@/lib/db-errors'
import type { Tables } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import type { AccountFormValues } from './schemas'

// Único ponto de acesso à tabela accounts. A RLS garante no servidor que só vemos/alteramos as nossas.

export type Account = Tables<'accounts'>
export type AccountPatch = Partial<
  Pick<Account, 'nome' | 'tipo' | 'saldo_inicial_centavos' | 'arquivada'>
>

const MESSAGES = {
  '23505': 'Já existe uma conta com esse nome.',
  '23503': 'Esta conta tem transações. Arquiva-a em vez de a apagar.',
}

function fail(error: { code?: string; message?: string }): never {
  throw new UserFacingError(dbErrorMessage(error, MESSAGES))
}

export function sortAccounts(accounts: Account[]): Account[] {
  return [...accounts].sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }))
}

export async function listAccounts(): Promise<Account[]> {
  const { data, error } = await supabase.from('accounts').select('*')
  if (error) fail(error)
  return sortAccounts(data)
}

export async function createAccount({
  nome,
  tipo,
  saldoInicial,
}: AccountFormValues): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .insert({ nome, tipo, saldo_inicial_centavos: saldoInicial })
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
  if (error) fail(error)
}
