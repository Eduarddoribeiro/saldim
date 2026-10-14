import { dbErrorMessage, UserFacingError } from '@/lib/db-errors'
import type { Tables } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

export type Profile = Tables<'profiles'>

/** O perfil do utilizador da sessão (a RLS só devolve o próprio). */
export async function getProfile(): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').single()
  if (error) throw new UserFacingError(dbErrorMessage(error))
  return data
}
