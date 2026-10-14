import type { Session } from '@supabase/supabase-js'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { AuthContext, type AuthContextValue } from './auth-context'
import { authErrorMessage } from './auth-errors'

/** Único ponto da app que fala com o Supabase Auth. As páginas usam `useAuth()`. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Dispara logo com INITIAL_SESSION (sessão guardada ou null) e depois a cada login/logout/renovação.
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,

      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error: authErrorMessage(error) }
      },

      async signUp(nome, email, password) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          // `nome` vai para raw_user_meta_data; o trigger handle_new_user copia-o para profiles
          options: { data: { nome }, emailRedirectTo: window.location.origin },
        })
        return { error: authErrorMessage(error), needsConfirmation: !error && !data.session }
      },

      async signOut() {
        const { error } = await supabase.auth.signOut()
        return { error: authErrorMessage(error) }
      },

      async requestPasswordReset(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/nova-senha`,
        })
        return { error: authErrorMessage(error) }
      },

      async updatePassword(password) {
        const { error } = await supabase.auth.updateUser({ password })
        return { error: authErrorMessage(error) }
      },
    }),
    [session, loading],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
