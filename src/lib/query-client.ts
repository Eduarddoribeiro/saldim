import { QueryClient } from '@tanstack/react-query'

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Dados financeiros pessoais mudam pouco e só por ação do próprio utilizador:
        // 30 s evita pedidos repetidos ao navegar entre páginas.
        staleTime: 30_000,
        retry: 1,
      },
    },
  })
}
