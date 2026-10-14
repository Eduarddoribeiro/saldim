import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import type { MonthKey } from '@/lib/dates'
import type { TransactionFormValues } from './schemas'
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from './transactions-api'

// ['transactions', userId] é o prefixo de todos os meses: uma alteração invalida-os todos
// (uma transação pode mudar de mês ao editar a data).
export const transactionsKey = (userId: string | undefined) => ['transactions', userId] as const
export const transactionsMonthKey = (userId: string | undefined, month: MonthKey) =>
  [...transactionsKey(userId), month] as const

export function useTransactions(month: MonthKey) {
  const { user } = useAuth()
  return useQuery({
    queryKey: transactionsMonthKey(user?.id, month),
    queryFn: () => listTransactions(month),
    enabled: Boolean(user),
  })
}

function useInvalidateTransactions() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: transactionsKey(user?.id) })
}

export function useCreateTransaction() {
  const invalidate = useInvalidateTransactions()
  return useMutation({
    mutationFn: (values: TransactionFormValues) => createTransaction(values),
    onSuccess: invalidate,
  })
}

export function useUpdateTransaction() {
  const invalidate = useInvalidateTransactions()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: TransactionFormValues }) =>
      updateTransaction(id, values),
    onSuccess: invalidate,
  })
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateTransactions()
  return useMutation({ mutationFn: (id: string) => deleteTransaction(id), onSuccess: invalidate })
}
