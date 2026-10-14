import type { Session } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { vi } from 'vitest'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context'
import { routes } from '@/routes'

export const TEST_EMAIL = 'ana@exemplo.pt'

export function fakeSession(email = TEST_EMAIL): Session {
  return {
    access_token: 'token-falso',
    refresh_token: 'refresh-falso',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      email,
      aud: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    },
  }
}

/** Contexto de autenticação falso: sem rede, cada ação é um `vi.fn` que o teste pode inspecionar. */
export function fakeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  const session = 'session' in overrides ? (overrides.session ?? null) : fakeSession()
  return {
    session,
    user: session?.user ?? null,
    loading: false,
    signIn: vi.fn(async () => ({ error: null })),
    signUp: vi.fn(async () => ({ error: null, needsConfirmation: false })),
    signOut: vi.fn(async () => ({ error: null })),
    requestPasswordReset: vi.fn(async () => ({ error: null })),
    updatePassword: vi.fn(async () => ({ error: null })),
    ...overrides,
  }
}

/** QueryClient novo por teste, sem novas tentativas (um erro aparece logo). */
export function testQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

/** Renderiza a app completa (rotas reais) num router em memória, com autenticação falsa. */
export function renderApp(path = '/', auth: AuthContextValue = fakeAuth()) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const queryClient = testQueryClient()
  const view = render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthContext value={auth}>
          <RouterProvider router={router} />
        </AuthContext>
      </QueryClientProvider>
    </ThemeProvider>,
  )
  return { router, auth, queryClient, ...view }
}
