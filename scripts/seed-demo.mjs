// Cria (ou recria) a conta de demonstração no Supabase LOCAL, com 6 meses de dados inventados.
// Serve para as capturas do README. As datas são relativas a hoje, por isso a demo nunca fica velha.
// Os dados entram como um utilizador normal (cliente com a chave pública + sessão): passam pelas
// mesmas funções, triggers e políticas RLS que a app usa.
// Uso: npm run demo:seed  (com `npm run db:start` e `npm run env:local` já feitos)
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
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

// --- Datas (sempre o dia LOCAL, como todayIso) ---
const now = new Date()
const iso = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const TODAY = iso(now)
/** Dia `day` do mês `monthsAgo` meses atrás (limitado ao último dia do mês). */
const day = (monthsAgo, d) => {
  const last = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0).getDate()
  return iso(new Date(now.getFullYear(), now.getMonth() - monthsAgo, Math.min(d, last)))
}
const firstOfMonth = (monthsAgo) => day(monthsAgo, 1)
const isPast = (date) => date <= TODAY

// Valores "aleatórios" mas sempre iguais (gerador com semente fixa)
let seed = 42
const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
const between = (min, max) => Math.round(min + random() * (max - min))

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

/** Falha logo, com a mensagem da base de dados, em vez de seguir com dados a meio. */
const ok = async (promise) => {
  const { data, error } = await promise
  if (error) throw new Error(`${error.message} (${error.hint ?? error.code})`)
  return data
}

const categories = await ok(supabase.from('categories').select('id, nome'))
const cat = (nome) => categories.find((category) => category.nome === nome).id

// --- 3. Contas e cartões ---
const [principal] = await ok(supabase.from('accounts').select('id'))
await ok(
  supabase
    .from('accounts')
    .update({ nome: 'Conta Nubank', saldo_inicial_centavos: 420000 })
    .eq('id', principal.id),
)
const conta = principal.id
await ok(
  supabase
    .from('accounts')
    .insert({ nome: 'Poupança', tipo: 'poupanca', saldo_inicial_centavos: 850000 }),
)
const [nubank, itau] = await ok(
  supabase
    .from('accounts')
    .insert([
      {
        nome: 'Cartão Nubank',
        tipo: 'cartao_credito',
        dia_fechamento: 3,
        dia_vencimento: 10,
        limite_centavos: 450000,
        conta_pagamento_id: conta,
      },
      {
        nome: 'Cartão Itaú',
        tipo: 'cartao_credito',
        dia_fechamento: 28,
        dia_vencimento: 7,
        limite_centavos: 700000,
        conta_pagamento_id: conta,
      },
    ])
    .select('id'),
)

// --- 4. Recorrências (próxima ocorrência no futuro) com o histórico dos meses passados ---
const recorrentes = [
  { descricao: 'Salário', tipo: 'receita', categoria: 'Salário', valor: 650000, dia: 5 },
  { descricao: 'Aluguel', tipo: 'despesa', categoria: 'Moradia', valor: 180000, dia: 10 },
  { descricao: 'Internet', tipo: 'despesa', categoria: 'Contas e serviços', valor: 11990, dia: 15 },
]
for (const r of recorrentes) {
  const proxima = isPast(day(0, r.dia)) ? day(-1, r.dia) : day(0, r.dia)
  const [rec] = await ok(
    supabase
      .from('recorrencias')
      .insert({
        account_id: conta,
        category_id: cat(r.categoria),
        tipo: r.tipo,
        valor_centavos: r.valor,
        descricao: r.descricao,
        frequencia: 'mensal',
        dia: r.dia,
        proxima_data: proxima,
      })
      .select('id'),
  )
  const passadas = []
  for (let m = 5; m >= 0; m--) {
    if (day(m, r.dia) < proxima)
      passadas.push({
        account_id: conta,
        category_id: cat(r.categoria),
        tipo: r.tipo,
        valor_centavos: r.valor,
        descricao: r.descricao,
        data: day(m, r.dia),
        recorrencia_id: rec.id,
      })
  }
  await ok(supabase.from('transactions').insert(passadas))
}
// Assinaturas no cartão: a recorrência gera as próximas; as passadas são compras à vista
const assinaturas = [
  { descricao: 'Netflix', categoria: 'Lazer', valor: 4490, dia: 12, cartao: nubank.id },
  { descricao: 'Academia', categoria: 'Saúde', valor: 10990, dia: 8, cartao: itau.id },
]
for (const a of assinaturas) {
  const proxima = isPast(day(0, a.dia)) ? day(-1, a.dia) : day(0, a.dia)
  await ok(
    supabase.from('recorrencias').insert({
      account_id: a.cartao,
      category_id: cat(a.categoria),
      tipo: 'despesa',
      valor_centavos: a.valor,
      descricao: a.descricao,
      frequencia: 'mensal',
      dia: a.dia,
      proxima_data: proxima,
    }),
  )
}

// --- 5. Gastos do dia a dia na conta ---
const doDia = []
const gasto = (data, categoria, descricao, valor) => {
  if (isPast(data))
    doDia.push({
      account_id: conta,
      category_id: cat(categoria),
      tipo: 'despesa',
      valor_centavos: valor,
      descricao,
      data,
    })
}
for (let m = 5; m >= 0; m--) {
  for (const d of [3, 11, 18, 26]) gasto(day(m, d), 'Alimentação', 'Mercado', between(14000, 38000))
  gasto(day(m, 7), 'Alimentação', 'Padaria', between(2500, 5500))
  gasto(day(m, 20), 'Contas e serviços', 'Conta de luz', between(16000, 24000))
  gasto(day(m, 22), 'Transporte', 'Combustível', between(18000, 26000))
  gasto(day(m, 14), 'Saúde', 'Farmácia', between(3500, 12000))
}
doDia.push({
  account_id: conta,
  category_id: cat('Outras receitas'),
  tipo: 'receita',
  valor_centavos: 120000,
  descricao: 'Freela de design',
  data: day(2, 17),
})
await ok(supabase.from('transactions').insert(doDia))

// --- 6. Compras nos cartões (à vista, parceladas e da irmã) ---
const [ana] = await ok(supabase.from('pessoas').insert({ nome: 'Ana' }).select('id'))
const compra = (cartao, data, categoria, descricao, valor, parcelas = 1, pessoa = null) =>
  isPast(data)
    ? ok(
        supabase.rpc('registar_compra_cartao', {
          p_account_id: cartao,
          p_category_id: cat(categoria),
          p_data_compra: data,
          p_descricao: descricao,
          p_valor_total_centavos: valor,
          p_parcelas: parcelas,
          ...(pessoa ? { p_pessoa_id: pessoa } : {}),
        }),
      )
    : null
for (let m = 5; m >= 0; m--) {
  for (const a of assinaturas)
    if (day(m, a.dia) < (isPast(day(0, a.dia)) ? day(-1, a.dia) : day(0, a.dia)))
      await compra(a.cartao, day(m, a.dia), a.categoria, a.descricao, a.valor)
  await compra(nubank.id, day(m, 9), 'Alimentação', 'Restaurante', between(8000, 19000))
  await compra(nubank.id, day(m, 24), 'Lazer', 'Cinema', between(5000, 9000))
  await compra(itau.id, day(m, 16), 'Transporte', 'Uber', between(2500, 6000))
  await compra(itau.id, day(m, 27), 'Alimentação', 'iFood', between(6000, 11000))
}
await compra(itau.id, day(4, 19), 'Compras', 'Notebook', 420000, 10)
await compra(nubank.id, day(2, 6), 'Moradia', 'Geladeira', 289000, 6)
await compra(itau.id, day(1, 13), 'Compras', 'Tênis de corrida', 49990, 2)
// Compras da Ana no seu cartão: saem dos seus gastos e entram em "A receber"
await compra(nubank.id, day(3, 21), 'Compras', 'Celular da Ana', 179880, 6, ana.id)
await compra(itau.id, day(1, 10), 'Lazer', 'Show', 32000, 1, ana.id)
await compra(itau.id, day(0, 2), 'Compras', 'Passagem de ônibus', 18900, 1, ana.id)
await ok(
  supabase.from('reembolsos').insert([
    {
      pessoa_id: ana.id,
      account_id: conta,
      valor_centavos: 59960,
      data: day(2, 12),
      descricao: 'Pix',
    },
    {
      pessoa_id: ana.id,
      account_id: conta,
      valor_centavos: 50000,
      data: day(1, 12),
      descricao: 'Pix',
    },
  ]),
)

// --- 7. Pagar as faturas que já venceram (com a conta Nubank, 2 dias antes do vencimento) ---
const faturas = await ok(
  supabase.from('faturas').select('id, account_id, data_vencimento').lte('data_vencimento', TODAY),
)
for (const fatura of faturas) {
  const movimentos = await ok(
    supabase.from('transactions').select('tipo, valor_centavos').eq('fatura_id', fatura.id),
  )
  const total = movimentos.reduce(
    (sum, t) => sum + (t.tipo === 'estorno' ? -t.valor_centavos : t.valor_centavos),
    0,
  )
  if (total <= 0) continue
  const venc = new Date(`${fatura.data_vencimento}T12:00:00`)
  venc.setDate(venc.getDate() - 2)
  await ok(
    supabase.from('transferencias').insert({
      conta_origem_id: conta,
      conta_destino_id: fatura.account_id,
      fatura_id: fatura.id,
      valor_centavos: total,
      data: iso(venc) < TODAY ? iso(venc) : TODAY,
      descricao: 'Pagamento da fatura',
    }),
  )
}

// --- 8. Orçamentos do mês e do anterior ---
const limites = { Alimentação: 200000, Lazer: 50000, Transporte: 45000, Compras: 80000 }
await ok(
  supabase.from('budgets').insert(
    [0, 1].flatMap((m) =>
      Object.entries(limites).map(([nome, limite]) => ({
        category_id: cat(nome),
        mes: firstOfMonth(m),
        limite_centavos: limite,
      })),
    ),
  ),
)

console.log(`Demo criada: ${DEMO_EMAIL} / ${DEMO_PASSWORD} (Supabase local, dados até ${TODAY})`)
