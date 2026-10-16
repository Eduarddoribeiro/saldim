import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { invoicesKey } from '@/features/invoices/hooks'
import { transactionsKey } from '@/features/transactions/hooks'
import { deletePurchase, listPurchases, registerPurchase } from './purchases-api'
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

/** Uma compra muda as compras, as transações (as parcelas) e as faturas: invalida as três. */
function useInvalidatePurchases() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: purchasesKey(user?.id) }),
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
