import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import {
  createTransfer,
  deletePayment,
  listAccountTransfers,
  listTransfers,
  type TransferValues,
} from './transfers-api'

export const transfersKey = (userId: string | undefined) => ['transfers', userId] as const

/** Todas as transferências (para os saldos). */
export function useTransfers() {
  const { user } = useAuth()
  return useQuery({
    queryKey: transfersKey(user?.id),
    queryFn: listTransfers,
    enabled: Boolean(user),
  })
}

/** Transferências entre contas suas (sem os pagamentos de faturas), com id e descrição. */
export function useAccountTransfers() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...transfersKey(user?.id), 'entre-contas'] as const,
    queryFn: () => listAccountTransfers(),
    enabled: Boolean(user),
  })
}

function useInvalidateTransfers() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: transfersKey(user?.id) })
}

export function useCreateTransfer() {
  const invalidate = useInvalidateTransfers()
  return useMutation({
    mutationFn: (values: TransferValues) => createTransfer(values),
    onSuccess: invalidate,
  })
}

export function useDeleteTransfer() {
  const invalidate = useInvalidateTransfers()
  return useMutation({ mutationFn: (id: string) => deletePayment(id), onSuccess: invalidate })
}
