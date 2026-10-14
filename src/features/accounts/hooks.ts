import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import {
  createAccount,
  deleteAccount,
  listAccounts,
  updateAccount,
  type AccountPatch,
} from './accounts-api'
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

function useInvalidateAccounts() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: accountsKey(user?.id) })
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
