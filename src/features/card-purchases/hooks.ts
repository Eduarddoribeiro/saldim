import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { invoicesKey } from '@/features/invoices/hooks'
import { transactionsKey } from '@/features/transactions/hooks'
import {
  deletePurchase,
  deleteRefund,
  listPurchases,
  listRefunds,
  registerPurchase,
  registerRefund,
  type RefundValues,
} from './purchases-api'
import type { PurchaseFormValues } from './schemas'

export const purchasesKey = (userId: string | undefined) => ['card-purchases', userId] as const

export function usePurchases() {
  const { user } = useAuth()
  return useQuery({
    queryKey: purchasesKey(user?.id),
    queryFn: listPurchases,
    enabled: Boolean(user),
  })
}

export const refundsKey = (userId: string | undefined) => ['card-refunds', userId] as const

export function useRefunds() {
  const { user } = useAuth()
  return useQuery({
    queryKey: refundsKey(user?.id),
    queryFn: listRefunds,
    enabled: Boolean(user),
  })
}

/**
 * Uma compra ou um estorno muda as compras, os estornos, as transações (parcelas, estornos) e as
 * faturas: invalida tudo.
 */
function useInvalidatePurchases() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: purchasesKey(user?.id) }),
      queryClient.invalidateQueries({ queryKey: refundsKey(user?.id) }),
      queryClient.invalidateQueries({ queryKey: transactionsKey(user?.id) }),
      queryClient.invalidateQueries({ queryKey: invoicesKey(user?.id) }),
    ])
}

export function useRegisterPurchase() {
  const invalidate = useInvalidatePurchases()
  return useMutation({
    mutationFn: (values: PurchaseFormValues) => registerPurchase(values),
    onSuccess: invalidate,
  })
}

export function useDeletePurchase() {
  const invalidate = useInvalidatePurchases()
  return useMutation({ mutationFn: (id: string) => deletePurchase(id), onSuccess: invalidate })
}

export function useRegisterRefund() {
  const invalidate = useInvalidatePurchases()
  return useMutation({
    mutationFn: (values: RefundValues) => registerRefund(values),
    onSuccess: invalidate,
  })
}

export function useDeleteRefund() {
  const invalidate = useInvalidatePurchases()
  return useMutation({ mutationFn: (id: string) => deleteRefund(id), onSuccess: invalidate })
}
