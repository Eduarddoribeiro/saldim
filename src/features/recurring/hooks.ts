import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useAuth } from '@/features/auth/auth-context'
import { purchasesKey } from '@/features/card-purchases/hooks'
import { invoicesKey } from '@/features/invoices/hooks'
import { transactionsKey } from '@/features/transactions/hooks'
import { todayIso } from '@/lib/dates'
import { generateRecurring } from './generate-api'
import {
  createRecurring,
  deleteRecurring,
  listRecurring,
  updateRecurring,
  type RecurringPatch,
  type RecurringValues,
} from './recurring-api'

export const recurringKey = (userId: string | undefined) => ['recurring', userId] as const

export function useRecurring() {
  const { user } = useAuth()
  return useQuery({
    queryKey: recurringKey(user?.id),
    queryFn: listRecurring,
    enabled: Boolean(user),
  })
}

/**
 * Cria os lançamentos que já chegaram ao dia. Se criou algum, as transações, as compras no cartão e as
 * faturas mudaram; as recorrências mudam sempre (próxima data, avisos).
 */
export function useGenerateRecurring() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id
  return useCallback(async () => {
    const created = await generateRecurring(todayIso())
    const keys: (readonly unknown[])[] = [recurringKey(userId)]
    if (created > 0) keys.push(transactionsKey(userId), purchasesKey(userId), invoicesKey(userId))
    await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
    return created
  }, [queryClient, userId])
}

/** Depois de criar, mudar ou retomar uma recorrência, o lançamento de hoje pode já ser devido. */
function useAfterChange() {
  const generate = useGenerateRecurring()
  return () => generate()
}

export function useCreateRecurring() {
  const after = useAfterChange()
  return useMutation({
    mutationFn: (values: RecurringValues) => createRecurring(values),
    onSuccess: after,
  })
}

export function useUpdateRecurring() {
  const after = useAfterChange()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: RecurringPatch }) =>
      updateRecurring(id, patch),
    onSuccess: after,
  })
}

export function useDeleteRecurring() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteRecurring(id),
    // Os lançamentos já criados perdem a ligação ("Recorrente" deixa de aparecer)
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: recurringKey(user?.id) }),
        queryClient.invalidateQueries({ queryKey: transactionsKey(user?.id) }),
      ]),
  })
}
