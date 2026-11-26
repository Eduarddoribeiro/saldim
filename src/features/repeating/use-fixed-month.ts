import { isCreditCard } from '@/features/accounts/account-options'
import { useAccounts } from '@/features/accounts/hooks'
import { useInvoiceData } from '@/features/invoices/hooks'
import { summarizeInvoices } from '@/features/invoices/invoice-summary'
import { upcomingCardMonths } from '@/features/invoices/upcoming-months'
import {
  useProjectedCardCharges,
  useRecurringProjection,
} from '@/features/recurring/use-projection'
import { useBalanceMovements } from '@/features/transactions/hooks'
import { addMonths, lastDayOfMonth, todayIso } from '@/lib/dates'
import { useRepeatingExpenses } from './hooks'
import { nextMonthToPay } from './next-month'

/**
 * O mês fixo (o que entra e o que sai todo mês) e quanto vai sair no mês que vem, cartões e conta
 * juntos. `data` é null enquanto carrega.
 */
export function useFixedMonth() {
  const repeating = useRepeatingExpenses()
  const accounts = useAccounts()
  const movements = useBalanceMovements()
  const { invoices, items, payments } = useInvoiceData()
  const today = todayIso()
  const month = addMonths(today.slice(0, 7), 1)
  const projected = useRecurringProjection(lastDayOfMonth(month))
  const projectedCards = useProjectedCardCharges()

  const ready =
    repeating.data &&
    accounts.data &&
    movements.data &&
    invoices.data &&
    items.data &&
    payments.data
  if (!ready) return { data: null, isPending: repeating.isPending, error: repeating.error }

  const cardMonths = upcomingCardMonths(
    summarizeInvoices(invoices.data!, items.data!, payments.data!, today),
    today,
    projectedCards,
  )
  const proximoMes = nextMonthToPay({
    month,
    today,
    cardMonths,
    movements: movements.data!,
    projected,
    cardIds: new Set(accounts.data!.filter(isCreditCard).map((account) => account.id)),
  })
  const { totalMensal, rendaFixa } = repeating.data!
  return {
    data: { ...repeating.data!, sobra: rendaFixa - totalMensal, proximoMes },
    isPending: false,
    error: null,
  }
}
