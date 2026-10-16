import { dbErrorMessage, UserFacingError } from '@/lib/db-errors'
import type { IsoDate } from '@/lib/dates'
import { supabase } from '@/lib/supabase'

// Ficheiro à parte de recurring-api: a app chama-o sempre que abre (RecurringGenerator, no AppShell),
// por isso os testes de componentes simulam-no para todas as páginas em src/test/setup.ts.

/**
 * Cria os lançamentos recorrentes que já chegaram ao dia (até `today`, a data local) e devolve quantos
 * criou. Chamar várias vezes não duplica nada (D15).
 */
export async function generateRecurring(today: IsoDate): Promise<number> {
  const { data, error } = await supabase.rpc('gerar_recorrencias', { p_hoje: today })
  if (error) throw new UserFacingError(dbErrorMessage(error))
  return data
}
