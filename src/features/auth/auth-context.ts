import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

/** Resultado das ações: `error` já vem traduzido e pronto a mostrar ao utilizador. */
export type AuthResult = { error: string | null }

export type AuthContextValue = {
  session: Session | null
  user: User | null
  /** true até sabermos se há sessão guardada (evita mostrar o login por um instante a quem já entrou). */
  loading: boolean
  signIn: (email: string, password: string) => Promise<AuthResult>
  /** `needsConfirmation`: o servidor exige confirmação por e-mail antes de entrar. */
  signUp: (
    nome: string,
    email: string,
    password: string,
  ) => Promise<AuthResult & { needsConfirmation: boolean }>
  signOut: () => Promise<AuthResult>
  requestPasswordReset: (email: string) => Promise<AuthResult>
  updatePassword: (password: string) => Promise<AuthResult>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth tem de ser usado dentro de <AuthProvider>')
  return context
}
