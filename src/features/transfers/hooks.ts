import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { listTransfers } from './transfers-api'

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
