// Gera o .env do frontend a partir do Supabase LOCAL (`supabase status`).
// Copia apenas o URL e a chave PÚBLICA; a chave secreta nunca é escrita em ficheiro.
// Uso: npm run env:local  (com `npm run db:start` já a correr)
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const output = execSync('npx supabase status -o env', { encoding: 'utf8' })
const status = Object.fromEntries(
  output
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value]),
)

const url = status.API_URL
const publishableKey = status.PUBLISHABLE_KEY
if (!url || !publishableKey) {
  console.error(
    'Não encontrei API_URL/PUBLISHABLE_KEY. O Supabase local está a correr? (npm run db:start)',
  )
  process.exit(1)
}
if (!url.startsWith('http://127.0.0.1') && !url.startsWith('http://localhost')) {
  console.error(`Recusado: ${url} não é um Supabase local.`)
  process.exit(1)
}

writeFileSync(
  '.env',
  [
    '# Gerado por scripts/write-local-env.mjs — Supabase LOCAL (chaves de demonstração). Não versionar.',
    `VITE_SUPABASE_URL=${url}`,
    `VITE_SUPABASE_PUBLISHABLE_KEY=${publishableKey}`,
    '',
  ].join('\n'),
)
console.log(`.env escrito para ${url}`)
