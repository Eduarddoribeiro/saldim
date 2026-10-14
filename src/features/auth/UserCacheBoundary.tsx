import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, type ReactNode } from 'react'
import { useAuth } from './auth-context'

/**
 * Limpa o cache de dados quando o utilizador muda (sair, entrar com outra conta).
 * Sem isto, os dados da conta anterior podiam aparecer por instantes na seguinte.
 */
export function UserCacheBoundary({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id ?? null
  const previousUserId = useRef<string | null>(null)

  useEffect(() => {
    if (loading) return
    if (previousUserId.current !== userId) queryClient.clear()
    previousUserId.current = userId
  }, [userId, loading, queryClient])

  return children
}
