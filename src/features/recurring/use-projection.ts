import { isCreditCard } from '@/features/accounts/account-options'
import { useAccounts } from '@/features/accounts/hooks'
import { useImportHistory } from '@/features/transactions/hooks'
import { addMonths, lastDayOfMonth, todayIso, type IsoDate } from '@/lib/dates'
import { useRecurring } from './hooks'
import { projectedCardCharges, projectRecurring } from './projection'

/** Quantos meses de faturas mostram recorrentes previstos (os mesmos que as próximas faturas mostram um a um) */
export const PROJECTION_MONTHS = 3

/** Recorrentes previstos até `until` (vazio enquanto carrega). */
export function useRecurringProjection(until: IsoDate) {
  const recurring = useRecurring()
  // Para os "só lembrar": já foi pago este mês? qual foi o último valor?
  const history = useImportHistory()
  return projectRecurring(recurring.data ?? [], todayIso(), until, history.data ?? [])
}

/**
 * Recorrentes previstos nos cartões, cada um com o vencimento da fatura onde vai cair, até às faturas
 * que vencem daqui a PROJECTION_MONTHS meses.
 */
export function useProjectedCardCharges() {
  const accounts = useAccounts()
  const today = todayIso()
  const lastMonth = addMonths(today.slice(0, 7), PROJECTION_MONTHS)
  const occurrences = useRecurringProjection(lastDayOfMonth(lastMonth))
  const cards = (accounts.data ?? []).filter(isCreditCard)
  return projectedCardCharges(occurrences, cards).filter(
    (charge) => charge.vencimento.slice(0, 7) <= lastMonth,
  )
}
