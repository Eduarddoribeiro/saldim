import { beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../../src/lib/database.types'
import { installmentSchedule, invoiceDates, type CardConfig } from '../../src/lib/credit-card'
import {
  anonClient,
  createTestUser,
  twoUsers,
  withLocalDb,
  type Client,
  type TestUser,
} from './helpers'

// Etapa C3: faturas, compras parceladas e a função atómica registar_compra_cartao
// (migration faturas_compras). As regras valem para a função E para escritas diretas nas tabelas.

let a: TestUser
let b: TestUser
type Refs = { principal: string; despesa: string; receita: string }
let refsA: Refs
let refsB: Refs
/** Cartão de A com uma compra (para os testes de isolamento) */
let cartaoA: string
let compraA: string
let faturaA: string

async function refs(client: Client): Promise<Refs> {
  const [{ data: principal }, { data: despesa }, { data: receita }] = await Promise.all([
    client.from('accounts').select('id').eq('nome', 'Conta principal').single(),
    client.from('categories').select('id').eq('nome', 'Alimentação').single(),
    client.from('categories').select('id').eq('nome', 'Salário').single(),
  ])
  return { principal: principal!.id, despesa: despesa!.id, receita: receita!.id }
}

/**
 * Linha para inserir uma fatura diretamente. O tipo gerado exige as datas (NOT NULL), mas quem as
 * preenche é a trigger e o cliente nem tem permissão para as enviar; a interface usa a função.
 */
const novaFatura = (account_id: string, mes_referencia: string) =>
  ({ account_id, mes_referencia }) as Database['public']['Tables']['faturas']['Insert']

const FECHA_25_VENCE_5: CardConfig = { diaFechamento: 25, diaVencimento: 5 }

async function criarCartao(user: TestUser, config: CardConfig = FECHA_25_VENCE_5) {
  const { principal } = user === a ? refsA : user === b ? refsB : await refs(user.client)
  const { data, error } = await user.client
    .from('accounts')
    .insert({
      nome: `Cartão ${crypto.randomUUID().slice(0, 8)}`,
      tipo: 'cartao_credito',
      dia_fechamento: config.diaFechamento,
      dia_vencimento: config.diaVencimento,
      limite_centavos: 1_000_000,
      conta_pagamento_id: principal,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

type Compra = {
  cartao: string
  data: string
  total: number
  parcelas: number
  inicial?: number
  categoria?: string
  descricao?: string
}

function comprar(user: TestUser, compra: Compra) {
  return user.client.rpc('registar_compra_cartao', {
    p_account_id: compra.cartao,
    p_category_id: compra.categoria ?? (user === a ? refsA : refsB).despesa,
    p_data_compra: compra.data,
    p_valor_total_centavos: compra.total,
    p_parcelas: compra.parcelas,
    p_parcela_inicial: compra.inicial ?? 1,
    p_descricao: compra.descricao ?? '',
  })
}

/** Parcelas gravadas de uma compra, com as datas da fatura de cada uma, pela ordem. */
async function parcelasGravadas(client: Client, compraId: string) {
  const { data: parcelas, error } = await client
    .from('transactions')
    .select('parcela_numero, valor_centavos, data, tipo, fatura_id, category_id, descricao')
    .eq('compra_id', compraId)
    .order('parcela_numero')
  if (error) throw error
  const { data: faturas } = await client
    .from('faturas')
    .select('id, mes_referencia, data_fechamento, data_vencimento')
    .in(
      'id',
      parcelas.map((p) => p.fatura_id!),
    )
  const porId = new Map(faturas!.map((f) => [f.id, f]))
  return parcelas.map((p) => {
    const fatura = porId.get(p.fatura_id!)!
    return {
      numero: p.parcela_numero,
      valorCentavos: p.valor_centavos,
      data: p.data,
      mesFatura: fatura.mes_referencia.slice(0, 7),
      fechamento: fatura.data_fechamento,
      vencimento: fatura.data_vencimento,
    }
  })
}

/** O que a interface (src/lib/credit-card.ts) calcula para a mesma compra. */
function esperado(config: CardConfig, compra: Compra) {
  return installmentSchedule({
    dataCompra: compra.data,
    totalCentavos: compra.total,
    numeroParcelas: compra.parcelas,
    parcelaInicial: compra.inicial ?? 1,
    config,
  }).parcelas.map((parcela) => {
    const datas = invoiceDates(config, parcela.mesFatura)
    return { ...parcela, fechamento: datas.fechamento, vencimento: datas.vencimento }
  })
}

/** Quantas compras, faturas e transações tem o cartão (para provar que nada ficou gravado). */
async function contagens(client: Client, cartao: string) {
  const count = async (tabela: 'compras_cartao' | 'faturas' | 'transactions') =>
    (
      await client
        .from(tabela)
        .select('id', { count: 'exact', head: true })
        .eq('account_id', cartao)
    ).count
  return {
    compras: await count('compras_cartao'),
    faturas: await count('faturas'),
    transacoes: await count('transactions'),
  }
}

beforeAll(async () => {
  ;({ a, b } = await twoUsers())
  ;[refsA, refsB] = await Promise.all([refs(a.client), refs(b.client)])
  cartaoA = await criarCartao(a)
  const { data, error } = await comprar(a, {
    cartao: cartaoA,
    data: '2026-10-10',
    total: 30000,
    parcelas: 3,
    descricao: 'Compra de A',
  })
  if (error) throw error
  compraA = data
  faturaA = (
    await a.client.from('faturas').select('id').eq('account_id', cartaoA).limit(1).single()
  ).data!.id
})

describe('registar_compra_cartao — parcelas e faturas', () => {
  it('cria a compra, as faturas e as parcelas exatamente como installmentSchedule (100,00 em 3)', async () => {
    const cartao = await criarCartao(b)
    const compra = { cartao, data: '2026-10-10', total: 10000, parcelas: 3, descricao: 'Mercado' }
    const { data: id, error } = await comprar(b, compra)
    expect(error).toBeNull()

    const parcelas = await parcelasGravadas(b.client, id!)
    expect(parcelas).toEqual(esperado(FECHA_25_VENCE_5, compra))
    expect(parcelas.map((p) => p.valorCentavos)).toEqual([3333, 3333, 3334])
    expect(parcelas.map((p) => p.mesFatura)).toEqual(['2026-11', '2026-12', '2027-01'])

    const { data: gravada } = await b.client
      .from('compras_cartao')
      .select('valor_total_centavos, parcelas, parcela_inicial, data_compra, descricao')
      .eq('id', id!)
      .single()
    expect(gravada).toEqual({
      valor_total_centavos: 10000,
      parcelas: 3,
      parcela_inicial: 1,
      data_compra: '2026-10-10',
      descricao: 'Mercado',
    })
    // Cada parcela é uma despesa normal (conta para gastos e orçamentos) com a descrição e a categoria da compra
    const { data: linhas } = await b.client
      .from('transactions')
      .select('tipo, category_id, descricao')
      .eq('compra_id', id!)
    expect(new Set(linhas!.map((l) => `${l.tipo}|${l.category_id}|${l.descricao}`))).toEqual(
      new Set([`despesa|${refsB.despesa}|Mercado`]),
    )
  })

  it('MATRIZ: o resultado gravado = installmentSchedule em várias configurações, fins de mês e dias de fechamento', async () => {
    const configs: CardConfig[] = [
      { diaFechamento: 25, diaVencimento: 5 },
      { diaFechamento: 3, diaVencimento: 10 },
      { diaFechamento: 31, diaVencimento: 9 },
      { diaFechamento: 27, diaVencimento: 28 },
      { diaFechamento: 1, diaVencimento: 31 },
      { diaFechamento: 30, diaVencimento: 1 },
    ]
    const diferentes: string[] = []
    for (const config of configs) {
      const cartao = await criarCartao(b, config)
      const fechamento = invoiceDates(config, '2028-03').fechamento
      const vespera = new Date(`${fechamento}T00:00:00Z`)
      vespera.setUTCDate(vespera.getUTCDate() - 1)
      const datas = [
        '2027-12-31',
        '2028-01-31',
        '2028-02-28',
        '2028-02-29',
        fechamento,
        vespera.toISOString().slice(0, 10),
      ]
      for (const data of datas) {
        const compra = { cartao, data, total: 100001, parcelas: 4 }
        const { data: id, error } = await comprar(b, compra)
        if (error) throw error
        if (
          JSON.stringify(await parcelasGravadas(b.client, id)) !==
          JSON.stringify(esperado(config, compra))
        ) {
          diferentes.push(`F=${config.diaFechamento} V=${config.diaVencimento} ${data}`)
        }
      }
    }
    expect(diferentes).toEqual([])
  })

  it('compra no dia do fechamento vai para a fatura seguinte (D2a)', async () => {
    const cartao = await criarCartao(b)
    const { data: noDia } = await comprar(b, {
      cartao,
      data: '2026-10-25',
      total: 100,
      parcelas: 1,
    })
    const { data: vespera } = await comprar(b, {
      cartao,
      data: '2026-10-24',
      total: 100,
      parcelas: 1,
    })
    expect((await parcelasGravadas(b.client, noDia!))[0].mesFatura).toBe('2026-12')
    expect((await parcelasGravadas(b.client, vespera!))[0].mesFatura).toBe('2026-11')
  })

  it('compra em curso (D5a): guarda o valor e as parcelas originais e só cria as que faltam', async () => {
    const cartao = await criarCartao(b)
    const compra = { cartao, data: '2026-06-15', total: 60001, parcelas: 6, inicial: 4 }
    const { data: id, error } = await comprar(b, compra)
    expect(error).toBeNull()
    const parcelas = await parcelasGravadas(b.client, id!)
    expect(parcelas).toEqual(esperado(FECHA_25_VENCE_5, compra))
    expect(parcelas.map((p) => [p.numero, p.valorCentavos, p.data])).toEqual([
      [4, 10000, '2026-09-15'],
      [5, 10000, '2026-10-15'],
      [6, 10001, '2026-11-15'],
    ])
    const { data: gravada } = await b.client
      .from('compras_cartao')
      .select('valor_total_centavos, parcelas, parcela_inicial')
      .eq('id', id!)
      .single()
    expect(gravada).toEqual({ valor_total_centavos: 60001, parcelas: 6, parcela_inicial: 4 })
  })

  it('limites: 1 parcela, 48 parcelas e o valor máximo; soma exata', async () => {
    const cartao = await criarCartao(b)
    for (const compra of [
      { cartao, data: '2026-10-10', total: 1, parcelas: 1 },
      { cartao, data: '2026-10-10', total: 48, parcelas: 48 },
      { cartao, data: '2026-10-10', total: 99_999_999_999, parcelas: 48 },
    ]) {
      const { data: id, error } = await comprar(b, compra)
      expect(error, JSON.stringify(compra)).toBeNull()
      const parcelas = await parcelasGravadas(b.client, id!)
      expect(parcelas).toEqual(esperado(FECHA_25_VENCE_5, compra))
      expect(parcelas.reduce((soma, p) => soma + p.valorCentavos, 0)).toBe(compra.total)
    }
  })

  it('duas compras no mesmo mês partilham a fatura (uma fatura por cartão e mês)', async () => {
    const cartao = await criarCartao(b)
    await comprar(b, { cartao, data: '2026-10-01', total: 5000, parcelas: 2 })
    await comprar(b, { cartao, data: '2026-10-20', total: 3000, parcelas: 3 })
    const { data: faturas } = await b.client
      .from('faturas')
      .select('mes_referencia')
      .eq('account_id', cartao)
      .order('mes_referencia')
    expect(faturas!.map((f) => f.mes_referencia)).toEqual([
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
    ])
  })
})

describe('registar_compra_cartao — atomicidade e validação no servidor', () => {
  it('ATOMICIDADE: uma falha na parcela 7 de 12 não deixa compra, faturas nem parcelas', async () => {
    const cartao = await criarCartao(b)
    // 1.ª fatura em jul/2999: as parcelas 1–6 vão até dez/2999 e a 7.ª fatura seria em jan/3000,
    // fora do intervalo aceite. As faturas e parcelas 1–6 já tinham sido inseridas quando falha.
    const { error } = await comprar(b, { cartao, data: '2999-06-10', total: 12000, parcelas: 12 })
    expect(error?.code).toBe('23514')
    expect(error?.message).toContain('faturas_mes_check')
    expect(await contagens(b.client, cartao)).toEqual({ compras: 0, faturas: 0, transacoes: 0 })

    // As 6 primeiras parcelas, sozinhas, são aceites: a falha foi mesmo a meio do ciclo.
    const { error: seis } = await comprar(b, {
      cartao,
      data: '2999-06-10',
      total: 12000,
      parcelas: 6,
    })
    expect(seis).toBeNull()
  })

  it('valores, parcelas, datas e descrição inválidos são recusados e nada fica gravado', async () => {
    const cartao = await criarCartao(b)
    const base = { cartao, data: '2026-10-10', total: 1000, parcelas: 2 }
    const invalidas: Compra[] = [
      { ...base, total: 0 },
      { ...base, total: -100 },
      { ...base, total: 100_000_000_000 },
      { ...base, total: 3, parcelas: 4 },
      { ...base, parcelas: 0 },
      { ...base, parcelas: 49 },
      { ...base, inicial: 0 },
      { ...base, inicial: 3 },
      { ...base, data: '1899-12-31' },
      { ...base, data: '3000-01-01' },
      { ...base, descricao: 'x'.repeat(121) },
      { ...base, descricao: ' com espaços ' },
    ]
    for (const compra of invalidas) {
      const { error } = await comprar(b, compra)
      expect(error?.code, JSON.stringify(compra)).toBe('23514')
    }
    expect(await contagens(b.client, cartao)).toEqual({ compras: 0, faturas: 0, transacoes: 0 })
  })

  it('só aceita um cartão e uma categoria de despesa', async () => {
    const naoCartao = await comprar(b, {
      cartao: refsB.principal,
      data: '2026-10-10',
      total: 1000,
      parcelas: 1,
    })
    expect(naoCartao.error?.hint).toBe('compras_cartao_conta_check')

    const cartao = await criarCartao(b)
    const receita = await comprar(b, {
      cartao,
      categoria: refsB.receita,
      data: '2026-10-10',
      total: 1000,
      parcelas: 1,
    })
    expect(receita.error?.hint).toBe('compras_cartao_categoria_check')
    expect(await contagens(b.client, cartao)).toEqual({ compras: 0, faturas: 0, transacoes: 0 })
  })

  it('a função é security invoker e anon não a executa', async () => {
    const [funcao] = await withLocalDb(
      async (db) =>
        (
          await db.query<{ prosecdef: boolean; anon: boolean; auth: boolean }>(`
            select p.prosecdef,
              has_function_privilege('anon', p.oid, 'execute') as anon,
              has_function_privilege('authenticated', p.oid, 'execute') as auth
            from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'registar_compra_cartao'`)
        ).rows,
    )
    expect(funcao).toEqual({ prosecdef: false, anon: false, auth: true })

    const { error } = await anonClient().rpc('registar_compra_cartao', {
      p_account_id: cartaoA,
      p_category_id: refsA.despesa,
      p_data_compra: '2026-10-10',
      p_valor_total_centavos: 100,
      p_parcelas: 1,
    })
    expect(error?.code).toBe('42501')
  })
})

describe('isolamento entre utilizadores (RLS)', () => {
  it('B não vê as faturas, as compras nem as parcelas de A', async () => {
    expect((await b.client.from('faturas').select('id').eq('account_id', cartaoA)).data).toEqual([])
    expect((await b.client.from('compras_cartao').select('id').eq('id', compraA)).data).toEqual([])
    expect(
      (await b.client.from('transactions').select('id').eq('compra_id', compraA)).data,
    ).toEqual([])
    // A vê as suas
    expect(
      (await a.client.from('transactions').select('id').eq('compra_id', compraA)).data,
    ).toHaveLength(3)
  })

  it('B não regista compras no cartão de A (erro igual ao de um id inexistente) nem com a categoria de A', async () => {
    const alheio = await comprar(b, {
      cartao: cartaoA,
      data: '2026-10-10',
      total: 100,
      parcelas: 1,
    })
    expect(alheio.error?.code).toBe('23503')
    const inexistente = await comprar(b, {
      cartao: crypto.randomUUID(),
      data: '2026-10-10',
      total: 100,
      parcelas: 1,
    })
    expect(inexistente.error?.code).toBe('23503')

    const cartao = await criarCartao(b)
    const categoriaDeA = await comprar(b, {
      cartao,
      categoria: refsA.despesa,
      data: '2026-10-10',
      total: 100,
      parcelas: 1,
    })
    expect(categoriaDeA.error?.code).toBe('23503')
    expect(await contagens(a.client, cartaoA)).toEqual({ compras: 1, faturas: 3, transacoes: 3 })
  })

  it('B não cria faturas no cartão de A nem liga uma parcela à fatura ou à compra de A', async () => {
    const fatura = await b.client.from('faturas').insert(novaFatura(cartaoA, '2030-01-01'))
    expect(fatura.error).not.toBeNull()

    const cartao = await criarCartao(b)
    // Compra em curso só com a parcela 2: o número 1 fica livre, por isso só a FK pode recusar
    const { data: compraB } = await comprar(b, {
      cartao,
      data: '2026-10-10',
      total: 100,
      parcelas: 2,
      inicial: 2,
    })
    const [parcelaB] = await parcelasGravadas(b.client, compraB!)
    const { data: faturaB } = await b.client
      .from('faturas')
      .select('id')
      .eq('account_id', cartao)
      .single()
    const linha = {
      account_id: cartao,
      category_id: refsB.despesa,
      tipo: 'despesa' as const,
      valor_centavos: parcelaB.valorCentavos,
      data: parcelaB.data,
    }
    const comFaturaDeA = await b.client
      .from('transactions')
      .insert({ ...linha, fatura_id: faturaA, compra_id: compraB!, parcela_numero: 1 })
    expect(comFaturaDeA.error?.code).toBe('23503')
    const comCompraDeA = await b.client
      .from('transactions')
      .insert({ ...linha, fatura_id: faturaB!.id, compra_id: compraA, parcela_numero: 4 })
    expect(comCompraDeA.error?.code).toBe('23503')
  })

  it('B não apaga a compra de A', async () => {
    const { data } = await b.client.from('compras_cartao').delete().eq('id', compraA).select()
    expect(data).toEqual([])
    expect(await contagens(a.client, cartaoA)).toEqual({ compras: 1, faturas: 3, transacoes: 3 })
  })

  it('anon não lê faturas nem compras', async () => {
    const anon = anonClient()
    for (const tabela of ['faturas', 'compras_cartao'] as const) {
      const { data, error } = await anon.from(tabela).select('id')
      expect(error?.code, tabela).toBe('42501')
      expect(data, tabela).toBeNull()
    }
  })
})

describe('integridade: escritas diretas não contornam as regras', () => {
  it('uma transação normal não usa um cartão (nem é movida para um)', async () => {
    const cartao = await criarCartao(b)
    const nova = await b.client.from('transactions').insert({
      account_id: cartao,
      category_id: refsB.despesa,
      tipo: 'despesa',
      valor_centavos: 1000,
    })
    expect(nova.error?.hint).toBe('transactions_conta_cartao_check')

    const { data: tx } = await b.client
      .from('transactions')
      .insert({
        account_id: refsB.principal,
        category_id: refsB.despesa,
        tipo: 'despesa',
        valor_centavos: 500,
      })
      .select('id')
      .single()
    const mover = await b.client
      .from('transactions')
      .update({ account_id: cartao })
      .eq('id', tx!.id)
    expect(mover.error?.hint).toBe('transactions_conta_cartao_check')
  })

  it('uma transação de uma conta normal não tem fatura nem compra', async () => {
    const cartao = await criarCartao(b)
    const { data: compra } = await comprar(b, {
      cartao,
      data: '2026-10-10',
      total: 100,
      parcelas: 1,
    })
    const { data: fatura } = await b.client
      .from('faturas')
      .select('id')
      .eq('account_id', cartao)
      .single()
    const { error } = await b.client.from('transactions').insert({
      account_id: refsB.principal,
      category_id: refsB.despesa,
      tipo: 'despesa',
      valor_centavos: 100,
      data: '2026-10-10',
      fatura_id: fatura!.id,
      compra_id: compra!,
      parcela_numero: 2,
    })
    expect(error?.code).toBe('23503')

    const parcial = await b.client.from('transactions').insert({
      account_id: refsB.principal,
      category_id: refsB.despesa,
      tipo: 'despesa',
      valor_centavos: 100,
      parcela_numero: 1,
    })
    expect(parcial.error?.message).toContain('transactions_parcela_campos_check')
  })

  it('uma compra inserida diretamente sem as parcelas é recusada no fim da transação', async () => {
    const cartao = await criarCartao(b)
    const { error } = await b.client.from('compras_cartao').insert({
      account_id: cartao,
      category_id: refsB.despesa,
      data_compra: '2026-10-10',
      valor_total_centavos: 1000,
      parcelas: 2,
    })
    expect(error?.hint).toBe('compras_cartao_parcelas_check')
    expect(await contagens(b.client, cartao)).toEqual({ compras: 0, faturas: 0, transacoes: 0 })
  })

  it('uma parcela extra, repetida ou com valor, data ou fatura errados é recusada', async () => {
    const cartao = await criarCartao(b)
    const { data: compra } = await comprar(b, {
      cartao,
      data: '2026-10-10',
      total: 10000,
      parcelas: 3,
    })
    const parcelas = await parcelasGravadas(b.client, compra!)
    const { data: faturas } = await b.client
      .from('faturas')
      .select('id, mes_referencia')
      .eq('account_id', cartao)
      .order('mes_referencia')
    const linha = (numero: number, overrides: Record<string, unknown> = {}) => ({
      account_id: cartao,
      category_id: refsB.despesa,
      tipo: 'despesa' as const,
      valor_centavos: parcelas[numero - 1]?.valorCentavos ?? 3333,
      data: parcelas[numero - 1]?.data ?? '2027-01-10',
      fatura_id: faturas![Math.min(numero, 3) - 1].id,
      compra_id: compra!,
      parcela_numero: numero,
      ...overrides,
    })
    const casos: [string, Record<string, unknown>, string][] = [
      ['parcela 4 de 3', linha(4), 'transactions_parcela_check'],
      ['valor errado', linha(1, { valor_centavos: 3334 }), 'transactions_parcela_check'],
      ['data errada', linha(1, { data: '2026-10-11' }), 'transactions_parcela_check'],
      ['fatura errada', linha(1, { fatura_id: faturas![1].id }), 'transactions_parcela_check'],
      ['categoria errada', linha(1, { category_id: refsB.receita }), 'transactions_parcela_check'],
    ]
    for (const [caso, valores, regra] of casos) {
      const { error } = await b.client.from('transactions').insert(valores as never)
      expect(`${error?.hint ?? ''} ${error?.message ?? ''}`, caso).toContain(regra)
    }
    const repetida = await b.client.from('transactions').insert(linha(2))
    expect(repetida.error?.code).toBe('23505')
    expect(await contagens(b.client, cartao)).toEqual({ compras: 1, faturas: 3, transacoes: 3 })
  })

  it('as datas de uma fatura são calculadas pelo servidor; não se alteram', async () => {
    const cartao = await criarCartao(b, { diaFechamento: 31, diaVencimento: 9 })
    const { data, error } = await b.client
      .from('faturas')
      .insert(novaFatura(cartao, '2028-03-01'))
      .select('data_fechamento, data_vencimento')
      .single()
    expect(error).toBeNull()
    expect(data).toEqual({ data_fechamento: '2028-02-29', data_vencimento: '2028-03-09' })

    const comDatas = await b.client.from('faturas').insert({
      account_id: cartao,
      mes_referencia: '2028-04-01',
      data_fechamento: '2028-04-01',
      data_vencimento: '2028-04-02',
    } as never)
    expect(comDatas.error?.code).toBe('42501')

    const alterar = await b.client
      .from('faturas')
      .update({ data_vencimento: '2028-03-20' } as never)
      .eq('account_id', cartao)
    expect(alterar.error?.code).toBe('42501')

    const foraDoDia1 = await b.client.from('faturas').insert(novaFatura(cartao, '2028-05-15'))
    expect(foraDoDia1.error?.message).toContain('faturas_mes_check')

    const contaNormal = await b.client
      .from('faturas')
      .insert(novaFatura(refsB.principal, '2028-03-01'))
    expect(contaNormal.error?.hint).toBe('faturas_conta_cartao_check')
  })

  it('parcelas e compras não se alteram (só a descrição da parcela); fatura e compra não se mudam', async () => {
    const cartao = await criarCartao(b)
    const { data: compra } = await comprar(b, {
      cartao,
      data: '2026-10-10',
      total: 10000,
      parcelas: 2,
    })
    const { data: parcela } = await b.client
      .from('transactions')
      .select('id')
      .eq('compra_id', compra!)
      .eq('parcela_numero', 1)
      .single()

    for (const patch of [
      { valor_centavos: 1 },
      { data: '2026-10-11' },
      { account_id: refsB.principal },
      { tipo: 'receita' as const, category_id: refsB.receita },
    ]) {
      const { error } = await b.client.from('transactions').update(patch).eq('id', parcela!.id)
      expect(error?.hint, JSON.stringify(patch)).toBe('transactions_parcela_alterar_check')
    }
    const semFatura = await b.client
      .from('transactions')
      .update({ fatura_id: null } as never)
      .eq('id', parcela!.id)
    expect(semFatura.error?.code).toBe('42501')

    const descricao = await b.client
      .from('transactions')
      .update({ descricao: 'Nova descrição' })
      .eq('id', parcela!.id)
      .select('descricao')
      .single()
    expect(descricao.data?.descricao).toBe('Nova descrição')

    const alterarCompra = await b.client
      .from('compras_cartao')
      .update({ valor_total_centavos: 1 } as never)
      .eq('id', compra!)
    expect(alterarCompra.error?.code).toBe('42501')
  })

  it('uma parcela não se apaga sozinha; apagar a compra apaga as parcelas e mantém as faturas', async () => {
    const cartao = await criarCartao(b)
    const { data: compra } = await comprar(b, {
      cartao,
      data: '2026-10-10',
      total: 10000,
      parcelas: 3,
    })
    const sozinha = await b.client
      .from('transactions')
      .delete()
      .eq('compra_id', compra!)
      .eq('parcela_numero', 2)
    expect(sozinha.error?.hint).toBe('transactions_parcela_apagar_check')

    const apagar = await b.client.from('compras_cartao').delete().eq('id', compra!)
    expect(apagar.error).toBeNull()
    expect(await contagens(b.client, cartao)).toEqual({ compras: 0, faturas: 3, transacoes: 0 })
  })
})

describe('cartões com compras e faturas', () => {
  it('não se apagam o cartão nem a categoria de uma compra; sem compras, o cartão apaga-se', async () => {
    const cartao = await criarCartao(b)
    const { data: compra } = await comprar(b, {
      cartao,
      data: '2026-10-10',
      total: 100,
      parcelas: 1,
    })
    expect((await b.client.from('accounts').delete().eq('id', cartao)).error?.code).toBe('23503')
    expect((await b.client.from('categories').delete().eq('id', refsB.despesa)).error?.code).toBe(
      '23503',
    )

    await b.client.from('compras_cartao').delete().eq('id', compra!)
    const apagar = await b.client.from('accounts').delete().eq('id', cartao).select('id')
    expect(apagar.error).toBeNull()
    expect(apagar.data).toHaveLength(1)
  })

  it('até à C8: com faturas, os dias não mudam (limite e conta de pagamento sim) e o tipo não muda', async () => {
    const cartao = await criarCartao(b)
    const { data: compra } = await comprar(b, {
      cartao,
      data: '2026-10-10',
      total: 100,
      parcelas: 1,
    })

    const dias = await b.client.from('accounts').update({ dia_fechamento: 20 }).eq('id', cartao)
    expect(dias.error?.hint).toBe('accounts_cartao_dias_em_uso_check')

    const limite = await b.client
      .from('accounts')
      .update({ limite_centavos: 2_000_000, dia_fechamento: 25, dia_vencimento: 5 })
      .eq('id', cartao)
      .select('limite_centavos')
      .single()
    expect(limite.data?.limite_centavos).toBe(2_000_000)

    // Mesmo sem compras, as faturas que ficaram impedem a mudança de tipo
    await b.client.from('compras_cartao').delete().eq('id', compra!)
    const tipo = await b.client
      .from('accounts')
      .update({
        tipo: 'corrente',
        dia_fechamento: null,
        dia_vencimento: null,
        limite_centavos: null,
        conta_pagamento_id: null,
      })
      .eq('id', cartao)
    expect(tipo.error?.hint).toBe('accounts_tipo_cartao_em_uso_check')
  })

  it('apagar um utilizador com compras continua a funcionar (as parcelas vão em cascata)', async () => {
    const c = await createTestUser('c')
    const cartao = await criarCartao(c)
    const { data: despesa } = await c.client
      .from('categories')
      .select('id')
      .eq('nome', 'Alimentação')
      .single()
    const { error } = await c.client.rpc('registar_compra_cartao', {
      p_account_id: cartao,
      p_category_id: despesa!.id,
      p_data_compra: '2026-10-10',
      p_valor_total_centavos: 1000,
      p_parcelas: 3,
    })
    expect(error).toBeNull()

    const restantes = await withLocalDb(async (db) => {
      await db.query('delete from auth.users where id = $1', [c.id])
      return (
        await db.query<{ n: number }>(
          `select (select count(*) from public.compras_cartao where user_id = $1)
                + (select count(*) from public.faturas where user_id = $1)
                + (select count(*) from public.transactions where user_id = $1) as n`,
          [c.id],
        )
      ).rows[0].n
    })
    expect(Number(restantes)).toBe(0)
  })
})
