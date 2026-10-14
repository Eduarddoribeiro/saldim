import { dbErrorMessage, UserFacingError } from '@/lib/db-errors'
import type { Tables } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import type { CategoryFormValues } from './schemas'

// Único ponto de acesso à tabela categories. A RLS garante no servidor que só vemos/alteramos as nossas.

export type Category = Tables<'categories'>
export type CategoryPatch = Partial<Pick<Category, 'nome' | 'cor' | 'icone' | 'arquivada'>>

const MESSAGES = {
  '23505': 'Já existe uma categoria com esse nome.',
  '23503': 'Esta categoria tem transações. Arquiva-a em vez de a apagar.',
}

function fail(error: { code?: string; message?: string }): never {
  throw new UserFacingError(dbErrorMessage(error, MESSAGES))
}

/** Ordena por nome como um humano português espera (acentos e maiúsculas tratados). */
export function sortCategories(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity: 'base' }))
}

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*')
  if (error) fail(error)
  return sortCategories(data)
}

export async function createCategory(values: CategoryFormValues): Promise<Category> {
  // user_id não é enviado: a base preenche-o com auth.uid() e a RLS confirma-o.
  const { data, error } = await supabase.from('categories').insert(values).select().single()
  if (error) fail(error)
  return data
}

export async function updateCategory(id: string, patch: CategoryPatch): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) fail(error)
  return data
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) fail(error)
}
