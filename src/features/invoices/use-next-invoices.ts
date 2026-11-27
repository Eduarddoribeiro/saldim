import { useProjectedCardCharges } from '@/features/recurring/use-projection'
import { todayIso } from '@/lib/dates'
import { useInvoiceData } from './hooks'
import { summarizeInvoices } from './invoice-summary'
import { upcomingCardMonths } from './upcoming-months'

/** As próximas faturas de todos os cartões, por mês do vencimento (vazio enquanto carrega). */
export function useUpcomingCardMonths() {
  const { invoices, items, payments } = useInvoiceData()
  const projected = useProjectedCardCharges()
  if (!invoices.data || !items.data || !payments.data) return null
  const today = todayIso()
  return upcomingCardMonths(
    summarizeInvoices(invoices.data, items.data, payments.data, today),
    today,
    projected,
  )
}
