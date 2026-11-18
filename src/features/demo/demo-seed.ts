// Dados inventados da demonstração (6 meses, datas relativas a hoje, por isso nunca fica velha).
// Usado em dois sítios: na demo pública (cada visitante recebe uma conta anónima só dele e estes
// dados entram nela, pelo browser) e em scripts/seed-demo.mjs (conta demo@saldim.app no Supabase
// local, para as capturas do README).
//
// Os dados entram como um utilizador normal (chave pública + sessão): passam pelas mesmas funções,
// triggers e políticas RLS que a app usa. Por isso este ficheiro escreve em várias tabelas, uma
// exceção à regra "cada tabela só no seu <área>-api.ts".
//
// Sem imports em tempo de execução (só `import type`): o script corre-o com o Node diretamente.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/database.types'

type Client = SupabaseClient<Database>
type Result<T> = { data: T | null; error: { message: string; hint?: string; code?: string } | null }

/** Falha logo, com a mensagem da base de dados, em vez de seguir com dados a meio. */
async function ok<T>(request: PromiseLike<Result<T>>): Promise<T> {
  const { data, error } = await request
  if (error) throw new Error(`${error.message} (${error.hint || error.code})`)
  return data as T
}

/**
 * Preenche a conta da sessão com a demo. Espera uma conta acabada de criar (só com a "Conta
 * principal" e as categorias iniciais). `onProgress` recebe um número de 0 a 1.
 */
export async function seedDemoData(
  supabase: Client,
  now = new Date(),
  onProgress: (fraction: number) => void = () => {},
): Promise<void> {
  // --- Datas (sempre o dia LOCAL, como todayIso) ---
  const iso = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const TODAY = iso(now)
  /** Dia `d` do mês `monthsAgo` meses atrás (limitado ao último dia do mês). */
  const day = (monthsAgo: number, d: number) => {
    const last = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0).getDate()
    return iso(new Date(now.getFullYear(), now.getMonth() - monthsAgo, Math.min(d, last)))
  }
  const isPast = (date: string) => date <= TODAY
  /** A próxima ocorrência mensal de um dia: este mês, se ainda não passou, ou o seguinte. */
  const nextOf = (d: number) => (isPast(day(0, d)) ? day(-1, d) : day(0, d))

  // Valores "aleatórios" mas sempre iguais (gerador com semente fixa)
  let seed = 42
  const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
  const between = (min: number, max: number) => Math.round(min + random() * (max - min))

  const categories = await ok(supabase.from('categories').select('id, nome'))
  const cat = (nome: string) => {
    const found = categories.find((category) => category.nome === nome)
    if (!found) throw new Error(`Categoria inicial em falta: ${nome}`)
    return found.id
  }

  // --- 1. Contas e cartões ---
  const [principal] = await ok(supabase.from('accounts').select('id').order('created_at'))
  const conta = principal.id
  await ok(
    supabase
      .from('accounts')
      .update({ nome: 'Conta Nubank', saldo_inicial_centavos: 420000 })
      .eq('id', conta),
  )
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
  onProgress(0.1)

  // --- 2. Recorrências (próxima ocorrência no futuro) com o histórico dos meses passados ---
  const recorrentes = [
    { descricao: 'Salário', tipo: 'receita' as const, categoria: 'Salário', valor: 650000, dia: 5 },
    {
      descricao: 'Aluguel',
      tipo: 'despesa' as const,
      categoria: 'Moradia',
      valor: 180000,
      dia: 10,
    },
    {
      descricao: 'Internet',
      tipo: 'despesa' as const,
      categoria: 'Contas e serviços',
      valor: 11990,
      dia: 15,
    },
  ]
  for (const r of recorrentes) {
    const proxima = nextOf(r.dia)
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
  await ok(
    supabase.from('recorrencias').insert(
      assinaturas.map((a) => ({
        account_id: a.cartao,
        category_id: cat(a.categoria),
        tipo: 'despesa' as const,
        valor_centavos: a.valor,
        descricao: a.descricao,
        frequencia: 'mensal',
        dia: a.dia,
        proxima_data: nextOf(a.dia),
      })),
    ),
  )
  onProgress(0.2)

  // --- 3. Gastos do dia a dia na conta ---
  type Plain = Database['public']['Tables']['transactions']['Insert']
  const doDia: Plain[] = []
  const gasto = (data: string, categoria: string, descricao: string, valor: number) => {
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
    for (const d of [3, 11, 18, 26])
      gasto(day(m, d), 'Alimentação', 'Mercado', between(14000, 38000))
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
  onProgress(0.3)

  // --- 4. Compras nos cartões (à vista, parceladas e da irmã) ---
  const [ana] = await ok(supabase.from('pessoas').insert({ nome: 'Ana' }).select('id'))
  type Compra = [string, string, string, string, number, number?, string?]
  const compras: Compra[] = []
  for (let m = 5; m >= 0; m--) {
    for (const a of assinaturas)
      if (day(m, a.dia) < nextOf(a.dia))
        compras.push([a.cartao, day(m, a.dia), a.categoria, a.descricao, a.valor])
    compras.push([nubank.id, day(m, 9), 'Alimentação', 'Restaurante', between(8000, 19000)])
    compras.push([nubank.id, day(m, 24), 'Lazer', 'Cinema', between(5000, 9000)])
    compras.push([itau.id, day(m, 16), 'Transporte', 'Uber', between(2500, 6000)])
    compras.push([itau.id, day(m, 27), 'Alimentação', 'iFood', between(6000, 11000)])
  }
  compras.push([itau.id, day(4, 19), 'Compras', 'Notebook', 420000, 10])
  compras.push([nubank.id, day(2, 6), 'Moradia', 'Geladeira', 289000, 6])
  compras.push([itau.id, day(1, 13), 'Compras', 'Tênis de corrida', 49990, 2])
  // Compras da Ana no cartão de quem usa a app: saem dos gastos e entram em "A receber"
  compras.push([nubank.id, day(3, 21), 'Compras', 'Celular da Ana', 179880, 6, ana.id])
  compras.push([itau.id, day(1, 10), 'Lazer', 'Show', 32000, 1, ana.id])
  compras.push([itau.id, day(0, 2), 'Compras', 'Passagem de ônibus', 18900, 1, ana.id])

  const pending = compras.filter(([, data]) => isPast(data))
  // Uma de cada vez: duas compras na mesma fatura nova não podem criá-la ao mesmo tempo
  for (const [
    index,
    [cartao, data, categoria, descricao, valor, parcelas, pessoa],
  ] of pending.entries()) {
    await ok(
      supabase.rpc('registar_compra_cartao', {
        p_account_id: cartao,
        p_category_id: cat(categoria),
        p_data_compra: data,
        p_descricao: descricao,
        p_valor_total_centavos: valor,
        p_parcelas: parcelas ?? 1,
        ...(pessoa ? { p_pessoa_id: pessoa } : {}),
      }),
    )
    onProgress(0.3 + (0.5 * (index + 1)) / pending.length)
  }

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

  // --- 5. Pagar as faturas que já venceram (com a conta Nubank, 2 dias antes do vencimento) ---
  const [faturas, itens] = await Promise.all([
    ok(
      supabase
        .from('faturas')
        .select('id, account_id, data_vencimento')
        .lte('data_vencimento', TODAY),
    ),
    ok(
      supabase
        .from('transactions')
        .select('fatura_id, tipo, valor_centavos')
        .not('fatura_id', 'is', null),
    ),
  ])
  const pagamentos = faturas.flatMap((fatura) => {
    const total = itens
      .filter((item) => item.fatura_id === fatura.id)
      .reduce(
        (sum, item) => sum + (item.tipo === 'estorno' ? -item.valor_centavos : item.valor_centavos),
        0,
      )
    if (total <= 0) return []
    const venc = new Date(`${fatura.data_vencimento}T12:00:00`)
    venc.setDate(venc.getDate() - 2)
    return [
      {
        conta_origem_id: conta,
        conta_destino_id: fatura.account_id,
        fatura_id: fatura.id,
        valor_centavos: total,
        data: iso(venc) < TODAY ? iso(venc) : TODAY,
        descricao: 'Pagamento da fatura',
      },
    ]
  })
  if (pagamentos.length > 0) await ok(supabase.from('transferencias').insert(pagamentos))
  onProgress(0.95)

  // --- 6. Orçamentos do mês e do anterior ---
  const limites: Record<string, number> = {
    Alimentação: 200000,
    Lazer: 50000,
    Transporte: 45000,
    Compras: 80000,
  }
  await ok(
    supabase.from('budgets').insert(
      [0, 1].flatMap((m) =>
        Object.entries(limites).map(([nome, limite]) => ({
          category_id: cat(nome),
          mes: day(m, 1),
          limite_centavos: limite,
        })),
      ),
    ),
  )
  onProgress(1)
}
