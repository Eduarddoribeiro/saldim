import { useInvoices } from '@/features/invoices/hooks'
import { useBalanceMovements } from '@/features/transactions/hooks'
import { todayIso } from '@/lib/dates'
import { receivables, type Receivable } from '@/lib/finance'
import { usePeople, useReimbursements } from './hooks'

/**
 * O que cada pessoa deve (D22), com as regras de `receivables`: todas as parcelas das suas compras
 * − estornos − reembolsos; "vencido" = a parte em faturas cujo vencimento já chegou.
 */
export function useReceivables() {
  const movements = useBalanceMovements()
  const reimbursements = useReimbursements()
  const invoices = useInvoices()
  const people = usePeople()
  const queries = [movements, reimbursements, invoices, people]

  const today = todayIso()
  const dueInvoiceIds = new Set(
    (invoices.data ?? [])
      .filter((invoice) => invoice.data_vencimento <= today)
      .map((invoice) => invoice.id),
  )
  const data: Receivable[] = receivables(
    movements.data ?? [],
    reimbursements.data ?? [],
    dueInvoiceIds,
    people.data ?? [],
  )
  return {
    data,
    /** Para o detalhe por compra e por cartão (receivable-details) */
    movements: movements.data ?? [],
    dueInvoiceIds,
    /** Σ do que todas as pessoas devem (entra no saldo líquido, D20) */
    total: data.reduce((sum, row) => sum + row.total, 0),
    reimbursements,
    isPending: queries.some((query) => query.isPending),
    error: queries.find((query) => query.error)?.error ?? null,
    refetch: () => queries.forEach((query) => void query.refetch()),
  }
}
