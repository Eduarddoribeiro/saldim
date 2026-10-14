import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// Testes de integração contra o Supabase LOCAL (npm run db:start + npm run env:local).
// Separados de `npm test` porque precisam do Docker a correr.
export default defineConfig({
  test: {
    include: ['tests/rls/**/*.test.ts'],
    environment: 'node',
    env: loadEnv('development', process.cwd(), 'VITE_'),
    // Os ficheiros partilham a mesma base de dados: correr um de cada vez evita interferências
    fileParallelism: false,
    testTimeout: 20_000,
  },
})
