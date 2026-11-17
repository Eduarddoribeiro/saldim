import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { peopleKey } from '@/features/people/hooks'
import { acceptInvite, createInvite, listSharedDebts, stopSharing } from './sharing-api'

export const sharedDebtsKey = (userId: string | undefined) => ['shared-debts', userId] as const

/** O que a conta da sessão deve a quem a convidou (vazio para quase toda a gente). */
export function useSharedDebts() {
  const { user } = useAuth()
  return useQuery({
    queryKey: sharedDebtsKey(user?.id),
    queryFn: listSharedDebts,
    enabled: Boolean(user),
  })
}

export function useCreateInvite() {
  return useMutation({ mutationFn: (personId: string) => createInvite(personId) })
}

export function useAcceptInvite() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (token: string) => acceptInvite(token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sharedDebtsKey(user?.id) }),
  })
}

/** Deixar de compartilhar: o dono (lista de pessoas) ou quem lê (dívidas partilhadas). */
export function useStopSharing() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (personId: string) => stopSharing(personId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: peopleKey(user?.id) }),
        queryClient.invalidateQueries({ queryKey: sharedDebtsKey(user?.id) }),
      ]),
  })
}
