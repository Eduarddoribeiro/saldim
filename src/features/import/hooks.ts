import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { listAliases } from './aliases-api'

export const aliasesKey = (userId: string | undefined) => ['import-aliases', userId] as const

/** Os nomes escolhidos em importações anteriores. */
export function useImportAliases() {
  const { user } = useAuth()
  return useQuery({ queryKey: aliasesKey(user?.id), queryFn: listAliases, enabled: Boolean(user) })
}
