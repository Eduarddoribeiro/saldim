// Cria (ou recria) a conta de demonstração no Supabase LOCAL, com 6 meses de dados inventados.
// Serve para as capturas do README. As datas são relativas a hoje, por isso a demo nunca fica velha.
// Os dados entram como um utilizador normal (cliente com a chave pública + sessão): passam pelas
// mesmas funções, triggers e políticas RLS que a app usa.
// Uso: npm run demo:seed  (com `npm run db:start` e `npm run env:local` já feitos)
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import { seedDemoData } from '../src/features/demo/demo-seed.ts'
import { DEMO_EMAIL, DEMO_PASSWORD } from './seed-demo-credentials.mjs'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z_]+)=(.*)$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value]),
)
const url = env.VITE_SUPABASE_URL
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url ?? '')) {
  // Este script apaga e cria utilizadores: nunca correr contra um projeto real.
  console.error(`Recusado: ${url} não é um Supabase local.`)
  process.exit(1)
}

// --- 1. Apagar a demo anterior (Postgres local; o resto apaga em cascata) ---
const db = new pg.Client({
  connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
})
await db.connect()
await db.query('delete from auth.users where email = $1', [DEMO_EMAIL])
await db.end()

// --- 2. Criar o utilizador ---
const supabase = createClient(url, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const signUp = await supabase.auth.signUp({
  email: DEMO_EMAIL,
  password: DEMO_PASSWORD,
  options: { data: { nome: 'Marina' } },
})
if (signUp.error || !signUp.data.session) throw signUp.error ?? new Error('signUp sem sessão')

// Os dados (contas, cartões, recorrências, compras, a Ana, pagamentos, orçamentos) são os mesmos da
// demo pública: src/features/demo/demo-seed.ts
await seedDemoData(supabase)

const TODAY = new Date().toLocaleDateString('pt-BR')
console.log(`Demo criada: ${DEMO_EMAIL} / ${DEMO_PASSWORD} (Supabase local, dados até ${TODAY})`)
