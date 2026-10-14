import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import type { MonthKey } from '@/lib/dates'
import { copyBudgets, createBudget, deleteBudget, listBudgets, updateBudget } from './budgets-api'

export const budgetsKey = (userId: string | undefined) => ['budgets', userId] as const

export function useBudgets(month: MonthKey) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...budgetsKey(user?.id), month] as const,
    queryFn: () => listBudgets(month),
    enabled: Boolean(user),
  })
}

function useInvalidateBudgets() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: budgetsKey(user?.id) })
}

export function useSaveBudget() {
  const invalidate = useInvalidateBudgets()
  return useMutation({
    mutationFn: (input: { id?: string; categoryId: string; month: MonthKey; limite: number }) =>
      input.id ? updateBudget(input.id, input.limite) : createBudget(input),
    onSuccess: invalidate,
  })
}

export function useDeleteBudget() {
  const invalidate = useInvalidateBudgets()
  return useMutation({ mutationFn: (id: string) => deleteBudget(id), onSuccess: invalidate })
}

export function useCopyBudgets() {
  const invalidate = useInvalidateBudgets()
  return useMutation({
    mutationFn: ({ from, to }: { from: MonthKey; to: MonthKey }) => copyBudgets(from, to),
    onSuccess: invalidate,
  })
}
