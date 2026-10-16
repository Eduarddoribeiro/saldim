import { dbErrorMessage, UserFacingError } from '@/lib/db-errors'
import type { Enums, Tables } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import type { CategoryFormValues } from './schemas'

// Único ponto de acesso à tabela categories. A RLS garante no servidor que só vemos/alteramos as nossas.

/** Uma categoria é só de receita ou de despesa: o tipo `estorno` é das transações (CHECK `categories_tipo_check`). */
export type TipoCategoria = Exclude<Enums<'tipo_movimento'>, 'estorno'>
export type Category = Omit<Tables<'categories'>, 'tipo'> & { tipo: TipoCategoria }
export type CategoryPatch = Partial<Pick<Category, 'nome' | 'cor' | 'icone' | 'arquivada'>>

const MESSAGES = {
  '23505': 'Já existe uma categoria com esse nome.',
  '23503': 'Esta categoria tem transações. Arquiva-a em vez de a apagar.',
}

function fail(error: { code?: string; message?: string }): never {
  // FK da migration recorrentes: o nome da regra aparece no texto técnico do erro
  if (error.message?.includes('recorrencias_category_fk')) {
    throw new UserFacingError(
      'Esta categoria é usada num lançamento recorrente. Muda-o de categoria ou apaga-o primeiro (Configurações → Recorrentes).',
    )
  }
  throw new UserFacingError(dbErrorMessage(error, MESSAGES))
}

/** Ordena por nome como um humano português espera (acentos e maiúsculas tratados). */
export function sortCategories(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }))
}

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*')
  if (error) fail(error)
  // O CHECK categories_tipo_check garante que o tipo nunca é 'estorno'
  return sortCategories(data as Category[])
}

export async function createCategory(values: CategoryFormValues): Promise<Category> {
  // user_id não é enviado: a base preenche-o com auth.uid() e a RLS confirma-o.
  const { data, error } = await supabase.from('categories').insert(values).select().single()
  if (error) fail(error)
  return data as Category
}

export async function updateCategory(id: string, patch: CategoryPatch): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) fail(error)
  return data as Category
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) fail(error)
}
