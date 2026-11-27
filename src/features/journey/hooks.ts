import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import type { IsoDate } from '@/lib/dates'
import { closeDay, listClosedDays } from './journey-api'

export const closedDaysKey = (userId: string | undefined) => ['closed-days', userId] as const

export function useClosedDays() {
  const { user } = useAuth()
  return useQuery({
    queryKey: closedDaysKey(user?.id),
    queryFn: () => listClosedDays(),
    enabled: Boolean(user),
  })
}

export function useCloseDay() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dia: IsoDate) => closeDay(dia),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: closedDaysKey(user?.id) }),
  })
}
