import { dbErrorMessage, UserFacingError } from '@/lib/db-errors'
import { supabase } from '@/lib/supabase'
import { seedDemoData } from './demo-seed'

/** A conta da sessão já tem lançamentos? (a demo só se prepara numa conta vazia) */
export async function hasTransactions(): Promise<boolean> {
  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
  if (error) throw new UserFacingError(dbErrorMessage(error))
  return (count ?? 0) > 0
}

/** Enche a conta anónima do visitante com os dados inventados da demo. */
export async function prepareDemo(onProgress: (fraction: number) => void): Promise<void> {
  try {
    await seedDemoData(supabase, new Date(), onProgress)
  } catch {
    throw new UserFacingError('Não foi possível preparar a demonstração. Tente de novo.')
  }
}
