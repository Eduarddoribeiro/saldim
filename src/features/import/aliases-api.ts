import { dbErrorMessage, UserFacingError } from '@/lib/db-errors'
import { supabase } from '@/lib/supabase'

// Único ponto de acesso à tabela nomes_importacao (migration nomes_importacao): o nome que se deu a
// uma descrição do banco ao importar, para a próxima importação o sugerir.

export type ImportAlias = { chave: string; descricao: string }

export async function listAliases(): Promise<ImportAlias[]> {
  const { data, error } = await supabase.from('nomes_importacao').select('chave, descricao')
  if (error) throw new UserFacingError(dbErrorMessage(error))
  return data
}

/** Guarda (ou troca) os nomes de várias descrições do banco de uma vez. */
export async function saveAliases(aliases: ImportAlias[]): Promise<void> {
  if (aliases.length === 0) return
  const { error } = await supabase
    .from('nomes_importacao')
    .upsert(aliases, { onConflict: 'user_id,chave' })
  if (error) throw new UserFacingError(dbErrorMessage(error))
}
