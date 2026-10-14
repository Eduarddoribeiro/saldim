import pg from 'pg'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../src/lib/database.types'
import { readSupabaseConfig } from '../../src/lib/supabase-config'

export const config = readSupabaseConfig(process.env)

if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(config.url)) {
  // Estes testes criam utilizadores: nunca correr contra um projeto real.
  throw new Error(`Testes RLS só correm contra o Supabase local, não ${config.url}`)
}

export type Client = SupabaseClient<Database>

/** Cliente sem sessão (papel `anon`). */
export function anonClient(): Client {
  return createClient<Database>(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export type TestUser = { client: Client; id: string; email: string; password: string }

/** Dois utilizadores independentes: A (dono dos dados) e B (tenta aceder ao que não é seu). */
export async function twoUsers(): Promise<{ a: TestUser; b: TestUser }> {
  const [a, b] = await Promise.all([createTestUser('a'), createTestUser('b')])
  return { a, b }
}

// Ligação direta ao Postgres LOCAL (credenciais de demonstração do Supabase), só para ler o catálogo.
const LOCAL_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

/** Corre `fn` com uma ligação ao Postgres local e fecha-a no fim. */
export async function withLocalDb<T>(fn: (db: pg.Client) => Promise<T>): Promise<T> {
  const db = new pg.Client({ connectionString: LOCAL_DB_URL })
  await db.connect()
  try {
    return await fn(db)
  } finally {
    await db.end()
  }
}

/** Regista um utilizador novo (e-mail único) e devolve um cliente já autenticado como ele. */
export async function createTestUser(label: string): Promise<TestUser> {
  const client = anonClient()
  const email = `${label}-${crypto.randomUUID()}@teste.local`
  const password = 'senha-de-teste-123'
  const { data, error } = await client.auth.signUp({ email, password })
  if (error) throw error
  if (!data.user || !data.session)
    throw new Error('signUp não devolveu sessão (confirmação de e-mail ativa?)')
  return { client, id: data.user.id, email, password }
}
