import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// O AppShell cria os lançamentos recorrentes ao abrir (RecurringGenerator): em todos os testes de
// componentes essa chamada é simulada (0 criados). Um teste pode importar generateRecurring e verificá-la.
vi.mock('@/features/recurring/generate-api', () => ({
  generateRecurring: vi.fn(async () => 0),
}))

// Testes unitários e de componentes NUNCA vão à rede: o acesso a dados é simulado com vi.mock.
// Um fetch real aqui (ex.: uma página que pede dados sem mock) falha logo, em vez de depender do
// Supabase local estar ligado.
export const realFetchCalls: string[] = []
beforeEach(() => {
  realFetchCalls.length = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input)
      realFetchCalls.push(url)
      throw new TypeError(`Pedido de rede bloqueado em um teste unitário: ${url}`)
    }),
  )
})

// Desmonta o que cada teste renderizou, para os testes não interferirem entre si
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
