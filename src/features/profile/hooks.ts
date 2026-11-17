import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import type { Currency } from '@/lib/money'
import { getProfile, updateProfileName } from './profile-api'

export const profileKey = (userId: string | undefined) => ['profile', userId] as const

export function useProfile() {
  const { user } = useAuth()
  return useQuery({ queryKey: profileKey(user?.id), queryFn: getProfile, enabled: Boolean(user) })
}

/** Moeda de apresentação do utilizador; BRL enquanto o perfil carrega (é o valor por omissão na base). */
export function useCurrency(): Currency {
  const { data } = useProfile()
  return data?.moeda === 'EUR' ? 'EUR' : 'BRL'
}

export function useUpdateProfileName() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (nome: string) => updateProfileName(user?.id ?? '', nome),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKey(user?.id) }),
  })
}
