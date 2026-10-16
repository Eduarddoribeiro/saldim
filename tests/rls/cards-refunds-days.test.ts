import { beforeAll, describe, expect, it } from 'vitest'
import {
  invoiceDatesWithHistory,
  invoiceForPurchaseWithHistory,
  previewDaysChange,
  validateCardConfig,
  type CardConfig,
  type CardDaysChange,
} from '../../src/lib/credit-card'
import { addMonths, monthOf, type IsoDate, type MonthKey } from '../../src/lib/dates'
import { anonClient, twoUsers, type Client, type TestUser } from './helpers'

// Etapa C8: estornos (D11–D13) e mudança dos dias de um cartão com faturas (D14)
// (migrations tipo_estorno e estornos_dias_cartao). As regras valem para as funções E para escritas
// diretas. Os testes dos dias dependem de "hoje" (a fatura aberta), por isso as expectativas vêm do
// espelho em TypeScript (credit-card.ts), que tem de dar exatamente o mesmo que o SQL.

let a: TestUser
let b: TestUser
type Refs = { principal: string; despesa: string; outraDespesa: string }
let refsA: Refs
let refsB: Refs

/** Hoje em UTC (o servidor compara com current_date, em UTC). */
const hojeUtc = (): IsoDate => new Date().toISOString().slice(0, 10)
const diasDepois = (dias: number): IsoDate => {
  const data = new Date()
  data.setUTCDate(data.getUTCDate() + dias)
  return data.toISOString().slice(0, 10)
}
const mesDb = (mes: MonthKey) => `${mes}-01`

const DIAS = Array.from({ length: 31 }, (_, index) => index + 1)
const CONFIGS: CardConfig[] = DIAS.flatMap((f) =>
  DIAS.map((v) => ({ diaFechamento: f, diaVencimento: v })),
).filter((config) => validateCardConfig({ ...config, limiteCentavos: 100 }).ok)

async function refs(client: Client): Promise<Refs> {
  const [{ data: principal }, { data: despesa }, { data: outra }] = await Promise.all([
    client.from('accounts').select('id').eq('nome', 'Conta principal').single(),
    client.from('categories').select('id').eq('nome', 'Alimentação').single(),
    client.from('categories').select('id').eq('nome', 'Moradia').single(),
  ])
  return { principal: principal!.id, despesa: despesa!.id, outraDespesa: outra!.id }
}

const refsDe = (user: TestUser) => (user === a ? refsA : refsB)

async function criarCartao(
  user: TestUser,
  config: CardConfig = { diaFechamento: 25, diaVencimento: 5 },
) {
  const { data, error } = await user.client
    .from('accounts')
    .insert({
      nome: `Cartão ${crypto.randomUUID().slice(0, 8)}`,
      tipo: 'cartao_credito',
      dia_fechamento: config.diaFechamento,
      dia_vencimento: config.diaVencimento,
      limite_centavos: 1_000_000,
      conta_pagamento_id: refsDe(user).principal,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

async function comprar(user: TestUser, cartao: string, data: IsoDate, total = 30000, parcelas = 3) {
  const { data: compra, error } = await user.client.rpc('registar_compra_cartao', {
    p_account_id: cartao,
    p_category_id: refsDe(user).despesa,
    p_data_compra: data,
    p_valor_total_centavos: total,
    p_parcelas: parcelas,
  })
  if (error) throw error
  return compra
}

const estornar = (user: TestUser, compra: string, valor: number, data: IsoDate = hojeUtc()) =>
  user.client.rpc('registar_estorno_cartao', {
    p_compra_id: compra,
    p_data: data,
    p_valor_centavos: valor,
    p_descricao: 'Devolução',
  })

async function faturas(user: TestUser, cartao: string) {
  const { data, error } = await user.client
    .from('faturas')
    .select('id, mes_referencia, data_fechamento, data_vencimento')
    .eq('account_id', cartao)
    .order('mes_referencia')
  if (error) throw error
  return data
}

async function historico(user: TestUser, cartao: string): Promise<CardDaysChange[]> {
  const { data, error } = await user.client
    .from('cartao_dias_anteriores')
    .select('ate_mes, dia_fechamento, dia_vencimento')
    .eq('account_id', cartao)
  if (error) throw error
  return data.map((row) => ({
    ateMes: monthOf(row.ate_mes),
    config: { diaFechamento: row.dia_fechamento, diaVencimento: row.dia_vencimento },
  }))
}

const mudarDias = (user: TestUser, cartao: string, config: CardConfig) =>
  user.client
    .from('accounts')
    .update({ dia_fechamento: config.diaFechamento, dia_vencimento: config.diaVencimento })
    .eq('id', cartao)

/** Uma configuração (diferente da atual) que a mudança de hoje aceita, ou que recusa. */
const configPara = (atual: CardConfig, aceite: boolean) =>
  CONFIGS.find(
    (config) =>
      (config.diaFechamento !== atual.diaFechamento ||
        config.diaVencimento !== atual.diaVencimento) &&
      previewDaysChange(atual, [], config, hojeUtc()).ok === aceite,
  )

beforeAll(async () => {
  ;({ a, b } = await twoUsers())
  ;[refsA, refsB] = await Promise.all([refs(a.client), refs(b.client)])
})

describe('estornos (D11–D13)', () => {
  it('o estorno entra na fatura da sua data, com a categoria da compra, como crédito', async () => {
    const cartao = await criarCartao(a)
    const compra = await comprar(a, cartao, diasDepois(-70))
    const { data: id, error } = await estornar(a, compra, 10000)
    expect(error).toBeNull()

    const { data: estorno } = await a.client
      .from('transactions')
      .select('tipo, valor_centavos, data, category_id, compra_id, parcela_numero, fatura_id')
      .eq('id', id!)
      .single()
    expect(estorno).toMatchObject({
      tipo: 'estorno',
      valor_centavos: 10000,
      data: hojeUtc(),
      category_id: refsA.despesa,
      compra_id: compra,
      parcela_numero: null,
    })
    const fatura = (await faturas(a, cartao)).find((f) => f.id === estorno!.fatura_id)!
    const esperada = invoiceForPurchaseWithHistory(
      { diaFechamento: 25, diaVencimento: 5 },
      [],
      hojeUtc(),
    )
    expect(fatura.mes_referencia).toBe(mesDb(esperada))
  })

  it('estorno parcial e até ao total; nunca acima do valor da compra', async () => {
    const cartao = await criarCartao(a)
    const compra = await comprar(a, cartao, diasDepois(-10))
    expect((await estornar(a, compra, 10000)).error).toBeNull()
    expect((await estornar(a, compra, 20001)).error?.hint).toBe('transactions_estorno_valor_check')
    expect((await estornar(a, compra, 20000)).error).toBeNull()
    expect((await estornar(a, compra, 1)).error?.hint).toBe('transactions_estorno_valor_check')
  })

  it('dois estornos ao mesmo tempo não passam juntos do total', async () => {
    const cartao = await criarCartao(a)
    const compra = await comprar(a, cartao, diasDepois(-10))
    const resultados = await Promise.all([estornar(a, compra, 20000), estornar(a, compra, 20000)])
    expect(resultados.filter((r) => r.error === null)).toHaveLength(1)
    expect(resultados.find((r) => r.error)?.error?.hint).toBe('transactions_estorno_valor_check')
  })

  it('sem data futura (1 dia de tolerância) e nunca antes da compra', async () => {
    const cartao = await criarCartao(a)
    const compra = await comprar(a, cartao, diasDepois(-10))
    expect((await estornar(a, compra, 100, diasDepois(3))).error?.hint).toBe(
      'transactions_estorno_futuro_check',
    )
    expect((await estornar(a, compra, 100, diasDepois(-11))).error?.hint).toBe(
      'transactions_estorno_data_check',
    )
  })

  it('escritas diretas seguem as mesmas regras (fatura, categoria, compra)', async () => {
    const cartao = await criarCartao(a)
    const compra = await comprar(a, cartao, diasDepois(-70))
    const lista = await faturas(a, cartao)
    const certa = invoiceForPurchaseWithHistory(
      { diaFechamento: 25, diaVencimento: 5 },
      [],
      hojeUtc(),
    )
    // A compra de há 70 dias criou faturas; usa uma que não é a da data de hoje
    const errada = lista.find((f) => f.mes_referencia !== mesDb(certa))!
    const linha = {
      account_id: cartao,
      category_id: refsA.despesa,
      tipo: 'estorno' as const,
      valor_centavos: 100,
      data: hojeUtc(),
      compra_id: compra,
    }
    expect(
      (await a.client.from('transactions').insert({ ...linha, fatura_id: errada.id })).error?.hint,
    ).toBe('transactions_estorno_check')
    const faturaCerta = lista.find((f) => f.mes_referencia === mesDb(certa))
    if (faturaCerta) {
      const outraCategoria = await a.client
        .from('transactions')
        .insert({ ...linha, fatura_id: faturaCerta.id, category_id: refsA.outraDespesa })
      expect(outraCategoria.error?.hint).toBe('transactions_estorno_check')
      const direto = await a.client
        .from('transactions')
        .insert({ ...linha, fatura_id: faturaCerta.id })
      expect(direto.error).toBeNull()
    }
    // Sem compra: o CHECK recusa um estorno numa conta normal
    const semCompra = await a.client.from('transactions').insert({
      account_id: refsA.principal,
      category_id: refsA.despesa,
      tipo: 'estorno',
      valor_centavos: 100,
    })
    expect(semCompra.error?.message).toContain('transactions_cartao_campos_check')
  })

  it('um estorno não se altera (só a descrição) e apaga-se enquanto a fatura não tem pagamentos', async () => {
    const cartao = await criarCartao(a)
    const compra = await comprar(a, cartao, diasDepois(-10))
    const { data: id } = await estornar(a, compra, 5000)
    const valor = await a.client.from('transactions').update({ valor_centavos: 1 }).eq('id', id!)
    expect(valor.error?.hint).toBe('transactions_parcela_alterar_check')
    const descricao = await a.client
      .from('transactions')
      .update({ descricao: 'Troca' })
      .eq('id', id!)
      .select('descricao')
      .single()
    expect(descricao.data?.descricao).toBe('Troca')
    const apagar = await a.client.from('transactions').delete().eq('id', id!).select('id')
    expect(apagar.data).toHaveLength(1)
  })

  it('D6: com um pagamento na fatura, o estorno e a compra já não se apagam', async () => {
    const cartao = await criarCartao(a)
    const compra = await comprar(a, cartao, diasDepois(-10))
    const { data: id } = await estornar(a, compra, 5000)
    const { data: estorno } = await a.client
      .from('transactions')
      .select('fatura_id')
      .eq('id', id!)
      .single()
    const pagamento = await a.client.from('transferencias').insert({
      conta_origem_id: refsA.principal,
      conta_destino_id: cartao,
      fatura_id: estorno!.fatura_id,
      valor_centavos: 100,
      data: hojeUtc(),
    })
    expect(pagamento.error).toBeNull()
    expect((await a.client.from('transactions').delete().eq('id', id!)).error?.hint).toBe(
      'transactions_estorno_fatura_paga_check',
    )
    expect((await a.client.from('compras_cartao').delete().eq('id', compra)).error?.hint).toBe(
      'compras_cartao_fatura_paga_check',
    )
  })

  it('apagar a compra apaga também os seus estornos', async () => {
    const cartao = await criarCartao(a)
    const compra = await comprar(a, cartao, diasDepois(-10))
    await estornar(a, compra, 5000)
    expect((await a.client.from('compras_cartao').delete().eq('id', compra)).error).toBeNull()
    const { data } = await a.client.from('transactions').select('id').eq('compra_id', compra)
    expect(data).toEqual([])
  })

  it('não há categorias do tipo estorno', async () => {
    const { error } = await a.client
      .from('categories')
      .insert({ nome: 'Estornos', tipo: 'estorno', cor: 'slate', icone: 'tag' })
    expect(error?.message).toContain('categories_tipo_check')
  })

  it('isolamento: B não estorna nem vê os estornos de A', async () => {
    const cartao = await criarCartao(a)
    const compra = await comprar(a, cartao, diasDepois(-10))
    const { data: id } = await estornar(a, compra, 100)
    expect((await estornar(b, compra, 100)).error?.hint).toBe('transactions_estorno_compra_check')
    expect((await b.client.from('transactions').select('id').eq('id', id!)).data).toEqual([])
  })
})

describe('mudar os dias de um cartão com faturas (D14)', () => {
  const ANTIGOS: CardConfig = { diaFechamento: 25, diaVencimento: 5 }

  it('as faturas fechadas ficam; a aberta e as futuras passam aos dias novos (= TypeScript)', async () => {
    const cartao = await criarCartao(a, ANTIGOS)
    await comprar(a, cartao, diasDepois(-70), 30000, 6)
    const antes = await faturas(a, cartao)
    const novos = configPara(ANTIGOS, true)!
    const previsto = previewDaysChange(ANTIGOS, [], novos, hojeUtc())
    if (!previsto.ok) throw new Error('configPara devolveu uma configuração recusada')

    expect((await mudarDias(a, cartao, novos)).error).toBeNull()
    const hist = await historico(a, cartao)
    expect(hist).toEqual([{ ateMes: previsto.mesReferencia, config: ANTIGOS }])

    const depois = await faturas(a, cartao)
    expect(depois.map((f) => f.mes_referencia)).toEqual(antes.map((f) => f.mes_referencia))
    for (const fatura of depois) {
      const mes = monthOf(fatura.mes_referencia)
      const anterior = antes.find((f) => f.id === fatura.id)!
      if (mes < previsto.mesReferencia) {
        // Fechadas: não mudam
        expect(fatura).toEqual(anterior)
      } else {
        const datas = invoiceDatesWithHistory(novos, hist, mes)
        expect([fatura.data_fechamento, fatura.data_vencimento]).toEqual([
          datas.fechamento,
          datas.vencimento,
        ])
      }
    }
  })

  it('a fatura de cada data no SQL é igual à do TypeScript, com o histórico', async () => {
    const cartao = await criarCartao(a, ANTIGOS)
    await comprar(a, cartao, diasDepois(-40), 1000, 1)
    const novos = configPara(ANTIGOS, true)!
    expect((await mudarDias(a, cartao, novos)).error).toBeNull()
    const hist = await historico(a, cartao)
    const datas = Array.from({ length: 160 }, (_, index) => diasDepois(index - 100))
    const { data, error } = await a.client.rpc('cartao_fatura_da_compra_conta', {
      p_account_id: cartao,
      p_data: datas[0],
    })
    expect(error).toBeNull()
    expect(data).toBe(mesDb(invoiceForPurchaseWithHistory(novos, hist, datas[0])))
    const sql = await Promise.all(
      datas.map((dia) =>
        a.client.rpc('cartao_fatura_da_compra_conta', { p_account_id: cartao, p_data: dia }),
      ),
    )
    expect(sql.map((r) => r.data)).toEqual(
      datas.map((dia) => mesDb(invoiceForPurchaseWithHistory(novos, hist, dia))),
    )
  })

  it('uma compra registada depois da mudança, com data antiga, vai para a fatura certa', async () => {
    const cartao = await criarCartao(a, ANTIGOS)
    await comprar(a, cartao, diasDepois(-70), 1000, 1)
    const novos = configPara(ANTIGOS, true)!
    expect((await mudarDias(a, cartao, novos)).error).toBeNull()
    const hist = await historico(a, cartao)
    for (const dias of [-60, -35, -1]) {
      const compra = await comprar(a, cartao, diasDepois(dias), 1000, 2)
      const { data } = await a.client
        .from('transactions')
        .select('parcela_numero, faturas(mes_referencia)')
        .eq('compra_id', compra)
        .order('parcela_numero')
      const primeira = invoiceForPurchaseWithHistory(novos, hist, diasDepois(dias))
      expect(data!.map((p) => p.faturas!.mes_referencia)).toEqual([
        mesDb(primeira),
        mesDb(addMonths(primeira, 1)),
      ])
    }
  })

  it('recusa dias com que a fatura aberta fecharia hoje ou antes', async () => {
    const recusada = configPara(ANTIGOS, false)
    // Há sempre uma (ex.: V < F com F antes de hoje), mas se o calendário não der, o teste não se aplica
    if (!recusada) return
    const cartao = await criarCartao(a, ANTIGOS)
    await comprar(a, cartao, diasDepois(-10), 1000, 1)
    expect((await mudarDias(a, cartao, recusada)).error?.hint).toBe(
      'accounts_cartao_dias_transicao_check',
    )
    expect(await historico(a, cartao)).toEqual([])
  })

  it('recusa se a fatura aberta ou uma futura já tem pagamentos (o limite continua a mudar)', async () => {
    const cartao = await criarCartao(a, ANTIGOS)
    await comprar(a, cartao, diasDepois(-10), 1000, 3)
    const aberta = invoiceForPurchaseWithHistory(ANTIGOS, [], hojeUtc())
    const futura = (await faturas(a, cartao)).find((f) => f.mes_referencia > mesDb(aberta))!
    const pagamento = await a.client.from('transferencias').insert({
      conta_origem_id: refsA.principal,
      conta_destino_id: cartao,
      fatura_id: futura.id,
      valor_centavos: 100,
      data: hojeUtc(),
    })
    expect(pagamento.error).toBeNull()
    expect((await mudarDias(a, cartao, configPara(ANTIGOS, true)!)).error?.hint).toBe(
      'accounts_cartao_dias_pagamentos_check',
    )
    const limite = await a.client
      .from('accounts')
      .update({ limite_centavos: 5_000 })
      .eq('id', cartao)
    expect(limite.error).toBeNull()
  })

  it('recusa se uma compra com data futura mudasse de fatura (nada muda)', async () => {
    const cartao = await criarCartao(a, ANTIGOS)
    const data = diasDepois(20)
    await comprar(a, cartao, data, 1000, 1)
    const antes = await faturas(a, cartao)
    // Uma configuração aceite para hoje, mas com que a compra futura iria para outra fatura
    const muda = CONFIGS.find((config) => {
      const previsto = previewDaysChange(ANTIGOS, [], config, hojeUtc())
      if (!previsto.ok) return false
      const hist = [{ ateMes: previsto.mesReferencia, config: ANTIGOS }]
      return (
        invoiceForPurchaseWithHistory(config, hist, data) !==
        invoiceForPurchaseWithHistory(ANTIGOS, [], data)
      )
    })!
    expect((await mudarDias(a, cartao, muda)).error?.hint).toBe(
      'accounts_cartao_dias_compras_check',
    )
    expect(await faturas(a, cartao)).toEqual(antes)
    expect(await historico(a, cartao)).toEqual([])
  })

  it('mudar duas vezes no mesmo ciclo guarda só os dias que valeram nas faturas fechadas', async () => {
    const cartao = await criarCartao(a, ANTIGOS)
    await comprar(a, cartao, diasDepois(-40), 1000, 1)
    const aceites = CONFIGS.filter(
      (config) =>
        config.diaFechamento !== ANTIGOS.diaFechamento &&
        previewDaysChange(ANTIGOS, [], config, hojeUtc()).ok,
    )
    expect((await mudarDias(a, cartao, aceites[0])).error).toBeNull()
    const hist = await historico(a, cartao)
    const segunda = aceites.find(
      (config) =>
        config !== aceites[0] && previewDaysChange(aceites[0], hist, config, hojeUtc()).ok,
    )!
    expect((await mudarDias(a, cartao, segunda)).error).toBeNull()
    expect(await historico(a, cartao)).toEqual(hist)
  })

  it('o histórico e as datas das faturas não se escrevem diretamente', async () => {
    const cartao = await criarCartao(a, ANTIGOS)
    await comprar(a, cartao, diasDepois(-10), 1000, 1)
    const inserir = await a.client.from('cartao_dias_anteriores').insert({
      account_id: cartao,
      ate_mes: '2026-01-01',
      dia_fechamento: 1,
      dia_vencimento: 10,
    })
    expect(inserir.error?.hint).toBe('cartao_dias_anteriores_direto_check')
    const datas = await a.client
      .from('faturas')
      .update({ data_fechamento: '2026-01-01' })
      .eq('account_id', cartao)
    expect(datas.error?.hint).toBe('faturas_datas_fixas_check')
  })

  it('isolamento: B não vê o histórico de A; anon não lê nada', async () => {
    const cartao = await criarCartao(a, ANTIGOS)
    await comprar(a, cartao, diasDepois(-10), 1000, 1)
    expect((await mudarDias(a, cartao, configPara(ANTIGOS, true)!)).error).toBeNull()
    expect(await historico(a, cartao)).toHaveLength(1)
    expect(
      (await b.client.from('cartao_dias_anteriores').select('id').eq('account_id', cartao)).data,
    ).toEqual([])
    // B não muda o cartão de A (a RLS esconde-o: nenhuma linha alterada)
    const { data } = await b.client
      .from('accounts')
      .update({ dia_fechamento: 3 })
      .eq('id', cartao)
      .select('id')
    expect(data).toEqual([])
    const anon = await anonClient().from('cartao_dias_anteriores').select('id')
    expect(anon.error?.code).toBe('42501')
  })
})
