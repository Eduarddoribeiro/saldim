import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { invoicesKey } from '@/features/invoices/hooks'
import {
  createAccount,
  deleteAccount,
  listAccounts,
  updateAccount,
  type AccountPatch,
} from './accounts-api'
import { listCardDaysHistory } from './card-days-api'
import type { AccountFormValues } from './schemas'

export const accountsKey = (userId: string | undefined) => ['accounts', userId] as const

export function useAccounts() {
  const { user } = useAuth()
  return useQuery({
    queryKey: accountsKey(user?.id),
    queryFn: listAccounts,
    enabled: Boolean(user),
  })
}

export const cardDaysKey = (userId: string | undefined) => ['card-days', userId] as const

/**
 * Dias antigos dos cartões (C8): necessários para calcular as faturas de cartões cujos dias mudaram.
 * `enabled: false` não os pede.
 */
export function useCardDaysHistory({ enabled = true }: { enabled?: boolean } = {}) {
  const { user } = useAuth()
  return useQuery({
    queryKey: cardDaysKey(user?.id),
    queryFn: listCardDaysHistory,
    enabled: Boolean(user) && enabled,
  })
}

/** Mudar os dias de um cartão muda também o histórico e as datas das faturas abertas e futuras. */
function useInvalidateAccounts() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: accountsKey(user?.id) }),
      queryClient.invalidateQueries({ queryKey: cardDaysKey(user?.id) }),
      queryClient.invalidateQueries({ queryKey: invoicesKey(user?.id) }),
    ])
}

export function useCreateAccount() {
  const invalidate = useInvalidateAccounts()
  return useMutation({
    mutationFn: (values: AccountFormValues) => createAccount(values),
    onSuccess: invalidate,
  })
}

export function useUpdateAccount() {
  const invalidate = useInvalidateAccounts()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: AccountPatch }) => updateAccount(id, patch),
    onSuccess: invalidate,
  })
}

export function useDeleteAccount() {
  const invalidate = useInvalidateAccounts()
  return useMutation({ mutationFn: (id: string) => deleteAccount(id), onSuccess: invalidate })
}
