import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { FullScreenLoader } from '@/components/layout/FullScreenLoader'
import { useAuth } from './auth-context'

export const LOGIN_PATH = '/entrar'

/** Estado de navegação usado para voltar à página pedida depois do login. */
export type FromState = { from?: { pathname: string; search?: string } }

/**
 * Só deixa passar quem tem sessão; os outros vão para o login, lembrando para onde queriam ir.
 * Exceção: se a sessão terminou enquanto a pessoa já estava na app (ex.: carregou em Sair),
 * não guardamos destino — o próximo login começa no Início.
 */
export function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()
  // Padrão React "guardar informação de renderizações anteriores": atualizar estado durante a renderização
  // quando a condição muda (https://react.dev/reference/react/useState#storing-information-from-previous-renders)
  const [hadSession, setHadSession] = useState(false)
  if (session && !hadSession) setHadSession(true)

  if (loading) return <FullScreenLoader />
  if (!session) {
    const state: FromState | undefined = hadSession
      ? undefined
      : { from: { pathname: location.pathname, search: location.search } }
    return <Navigate to={LOGIN_PATH} replace state={state} />
  }
  return <Outlet />
}

/** Páginas só para quem NÃO entrou (login, registo…): quem já tem sessão vai para a app. */
export function PublicOnly() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenLoader />
  if (session) {
    const from = (location.state as FromState | null)?.from
    return <Navigate to={from ? `${from.pathname}${from.search ?? ''}` : '/'} replace />
  }
  return <Outlet />
}
