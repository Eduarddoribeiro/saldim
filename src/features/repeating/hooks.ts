import { usePurchases } from '@/features/card-purchases/hooks'
import { useRecurring } from '@/features/recurring/hooks'
import { useImportHistory } from '@/features/transactions/hooks'
import { todayIso } from '@/lib/dates'
import { repeatingExpenses } from './repeating'

/** Gastos que se repetem, calculados a partir do histórico, das compras e das recorrências. */
export function useRepeatingExpenses() {
  const history = useImportHistory()
  const purchases = usePurchases()
  const recurring = useRecurring()
  const queries = [history, purchases, recurring]
  const isPending = queries.some((query) => query.isPending)
  const error = queries.find((query) => query.error)?.error ?? null
  const data =
    isPending || error
      ? null
      : repeatingExpenses({
          movements: history.data ?? [],
          purchases: purchases.data ?? [],
          recurrences: recurring.data ?? [],
          today: todayIso(),
        })
  return { data, isPending, error, refetch: () => queries.forEach((query) => void query.refetch()) }
}
