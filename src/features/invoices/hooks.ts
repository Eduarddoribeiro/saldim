import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { listInvoiceItems } from '@/features/transactions/transactions-api'
import {
  createPayment,
  deletePayment,
  listInvoicePayments,
  type PaymentValues,
} from '@/features/transfers/transfers-api'
import { transfersKey } from '@/features/transfers/hooks'
import { listInvoices } from './invoices-api'

// ['invoices', userId] é o prefixo de tudo o que a página de faturas lê (faturas, parcelas,
// pagamentos): uma compra ou um pagamento invalida-o inteiro.
export const invoicesKey = (userId: string | undefined) => ['invoices', userId] as const

/** Faturas, parcelas e pagamentos (três pedidos paginados). */
export function useInvoiceData() {
  const { user } = useAuth()
  const enabled = Boolean(user)
  const invoices = useQuery({
    queryKey: [...invoicesKey(user?.id), 'faturas'] as const,
    queryFn: listInvoices,
    enabled,
  })
  const items = useQuery({
    queryKey: [...invoicesKey(user?.id), 'parcelas'] as const,
    queryFn: listInvoiceItems,
    enabled,
  })
  const payments = useQuery({
    queryKey: [...invoicesKey(user?.id), 'pagamentos'] as const,
    queryFn: listInvoicePayments,
    enabled,
  })
  return { invoices, items, payments }
}

/** Um pagamento muda as faturas e os saldos do Início (transferências). */
function useInvalidatePayments() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: invoicesKey(user?.id) }),
      queryClient.invalidateQueries({ queryKey: transfersKey(user?.id) }),
    ])
}

export function useCreatePayment() {
  const invalidate = useInvalidatePayments()
  return useMutation({
    mutationFn: (values: PaymentValues) => createPayment(values),
    onSuccess: invalidate,
  })
}

export function useDeletePayment() {
  const invalidate = useInvalidatePayments()
  return useMutation({ mutationFn: (id: string) => deletePayment(id), onSuccess: invalidate })
}
