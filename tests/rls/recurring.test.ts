import { beforeAll, describe, expect, it } from 'vitest'
import { invoiceForPurchase } from '../../src/lib/credit-card'
import type { IsoDate } from '../../src/lib/dates'
import { nextOccurrence, occurrencesUntil, type Frequency } from '../../src/lib/recurrence'
import { anonClient, twoUsers, withLocalDb, type Client, type TestUser } from './helpers'

// Etapa R1: lançamentos recorrentes (migration recorrentes; D15–D18 em docs/plano.md).
// Isolamento entre utilizadores, regras da tabela, geração pela função gerar_recorrencias (incluindo os
// lançamentos em atraso, compras no cartão, falhas e chamadas simultâneas) e SQL = TS nas datas.

let a: TestUser
let b: TestUser
type Refs = { conta: string; despesa: string; receita: string }
let refsA: Refs
let refsB: Refs

/** Hoje em UTC (o servidor compara com current_date, em UTC). */
const hojeUtc = (): IsoDate => new Date().toISOString().slice(0, 10)
const diasDepois = (dias: number): IsoDate => {
  const data = new Date()
  data.setUTCDate(data.getUTCDate() + dias)
  return data.toISOString().slice(0, 10)
}
const diaDe = (data: IsoDate) => Number(data.slice(8, 10))

async function refs(client: Client): Promise<Refs> {
  const [{ data: conta }, { data: despesa }, { data: receita }] = await Promise.all([
    client.from('accounts').select('id').eq('nome', 'Conta principal').single(),
    client.from('categories').select('id').eq('nome', 'Alimentação').single(),
    client.from('categories').select('id').eq('nome', 'Salário').single(),
  ])
  return { conta: conta!.id, despesa: despesa!.id, receita: receita!.id }
}

const refsDe = (user: TestUser) => (user === a ? refsA : refsB)

type Nova = {
  account_id?: string
  category_id?: string
  tipo?: 'receita' | 'despesa' | 'estorno'
  valor_centavos?: number
  descricao?: string
  frequencia?: string
  proxima_data?: IsoDate
  dia?: number
}

/** Insere uma recorrência (por omissão: despesa mensal de 55,90 com a próxima data hoje). */
function inserir(user: TestUser, nova: Nova = {}) {
  const proxima = nova.proxima_data ?? hojeUtc()
  return user.client
    .from('recorrencias')
    .insert({
      account_id: refsDe(user).conta,
      category_id: refsDe(user).despesa,
      tipo: 'despesa',
      valor_centavos: 5590,
      descricao: 'Netflix',
      frequencia: 'mensal',
      dia: diaDe(proxima),
      ...nova,
      proxima_data: proxima,
    } as never)
    .select('*')
    .single()
}

async function criar(user: TestUser, nova: Nova = {}) {
  const { data, error } = await inserir(user, nova)
  if (error) throw error
  return data
}

const gerar = (user: TestUser, hoje: IsoDate = hojeUtc()) =>
  user.client.rpc('gerar_recorrencias', { p_hoje: hoje })

async function lancamentos(user: TestUser, recorrencia: string) {
  const { data, error } = await user.client
    .from('transactions')
    .select('*')
    .eq('recorrencia_id', recorrencia)
    .order('data')
  if (error) throw error
  return data
}

async function recorrencia(user: TestUser, id: string) {
  const { data, error } = await user.client.from('recorrencias').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

/**
 * Põe a próxima data no passado, como se a app tivesse ficado fechada. Só é possível fora da API
 * (a regra D18 recusa-o): ligação direta ao Postgres local, sem triggers nesta sessão.
 */
async function recuar(id: string, proxima: IsoDate, dia = diaDe(proxima)) {
  await withLocalDb(async (db) => {
    await db.query("set session_replication_role = 'replica'")
    await db.query('update public.recorrencias set proxima_data = $1, dia = $2 where id = $3', [
      proxima,
      dia,
      id,
    ])
  })
}

/** A mesma data de há `meses` meses, no mesmo dia (cortado ao fim do mês). */
function mesesAtras(meses: number): IsoDate {
  const data = new Date()
  data.setUTCDate(1)
  data.setUTCMonth(data.getUTCMonth() - meses)
  return data.toISOString().slice(0, 8) + '10'
}

beforeAll(async () => {
  ;({ a, b } = await twoUsers())
  ;[refsA, refsB] = await Promise.all([refs(a.client), refs(b.client)])
})

describe('recorrencias — isolamento', () => {
  it('B não vê, não altera nem apaga a recorrência de A', async () => {
    const deA = await criar(a, { proxima_data: diasDepois(20) })

    const { data: visto } = await b.client.from('recorrencias').select('*').eq('id', deA.id)
    expect(visto).toEqual([])

    const { data: alterada } = await b.client
      .from('recorrencias')
      .update({ valor_centavos: 1 })
      .eq('id', deA.id)
      .select()
    expect(alterada).toEqual([])

    const { data: apagada } = await b.client.from('recorrencias').delete().eq('id', deA.id).select()
    expect(apagada).toEqual([])

    expect((await recorrencia(a, deA.id)).valor_centavos).toBe(5590)
  })

  it('B não cria recorrências com a conta ou a categoria de A', async () => {
    const conta = await inserir(b, { account_id: refsA.conta, category_id: refsB.despesa })
    expect(conta.error?.code).toBe('23503')
    const categoria = await inserir(b, { account_id: refsB.conta, category_id: refsA.despesa })
    expect(categoria.error?.code).toBe('23503')
  })

  it('B não cria recorrências em nome de A', async () => {
    const { error } = await b.client.from('recorrencias').insert({
      user_id: a.id,
      account_id: refsB.conta,
      category_id: refsB.despesa,
      tipo: 'despesa',
      valor_centavos: 100,
      descricao: 'Intrusa',
      frequencia: 'mensal',
      dia: diaDe(hojeUtc()),
      proxima_data: hojeUtc(),
    } as never)
    // user_id não está nas colunas permitidas (42501); mesmo que estivesse, a política recusava
    expect(error).not.toBeNull()
  })

  it('a geração de B não cria lançamentos nas recorrências de A', async () => {
    const deA = await criar(a, { descricao: 'Só de A', proxima_data: diasDepois(30) })
    await recuar(deA.id, mesesAtras(1))
    const { error } = await gerar(b)
    expect(error).toBeNull()
    expect(await lancamentos(a, deA.id)).toEqual([])
    expect((await recorrencia(a, deA.id)).proxima_data).toBe(mesesAtras(1))
  })

  it('anon não lê, não cria e não gera', async () => {
    const anon = anonClient()
    const { data } = await anon.from('recorrencias').select('*')
    expect(data ?? []).toEqual([])
    const { error: criarErro } = await anon.from('recorrencias').insert({
      account_id: refsA.conta,
      category_id: refsA.despesa,
      tipo: 'despesa',
      valor_centavos: 100,
      descricao: 'Anónima',
      frequencia: 'mensal',
      dia: diaDe(hojeUtc()),
      proxima_data: hojeUtc(),
    })
    expect(criarErro).not.toBeNull()
    const { error: gerarErro } = await anon.rpc('gerar_recorrencias', { p_hoje: hojeUtc() })
    expect(gerarErro).not.toBeNull()
  })
})

describe('recorrencias — regras', () => {
  it('a categoria tem de ser do tipo do lançamento', async () => {
    const { error } = await inserir(a, { tipo: 'receita', category_id: refsA.despesa })
    expect(error?.hint).toBe('recorrencias_categoria_check')
  })

  it('só receitas e despesas (não estornos)', async () => {
    // A categoria (de despesa) já não bate com o tipo; o CHECK recusaria também
    const { error } = await inserir(a, { tipo: 'estorno' })
    expect(error?.code).toBe('23514')
  })

  it('num cartão só há despesas', async () => {
    const cartao = await criarCartao(a)
    const { error } = await inserir(a, {
      account_id: cartao,
      tipo: 'receita',
      category_id: refsA.receita,
    })
    expect(error?.hint).toBe('recorrencias_cartao_check')
  })

  it('D18: a próxima data não pode ter passado (1 dia de tolerância)', async () => {
    const { error } = await inserir(a, { proxima_data: diasDepois(-2) })
    expect(error?.hint).toBe('recorrencias_data_check')
    const ontem = await inserir(a, { proxima_data: diasDepois(-1) })
    expect(ontem.error).toBeNull()

    // Ao mudar a data também; mudar outros campos de uma recorrência atrasada continua possível
    const futura = await criar(a, { proxima_data: diasDepois(5) })
    const { error: mudar } = await a.client
      .from('recorrencias')
      .update({ proxima_data: diasDepois(-3), dia: diaDe(diasDepois(-3)) })
      .eq('id', futura.id)
    expect(mudar?.hint).toBe('recorrencias_data_check')
    await recuar(futura.id, mesesAtras(2))
    const { error: valor } = await a.client
      .from('recorrencias')
      .update({ valor_centavos: 6000, ativa: false })
      .eq('id', futura.id)
    expect(valor).toBeNull()
  })

  it('o dia pedido e a próxima data têm de bater certo', async () => {
    // 30/11 com dia 31 é válido (novembro não tem 31); 15 com dia 31 não
    const ok = await inserir(a, { proxima_data: '2999-11-30', dia: 31 })
    expect(ok.error).toBeNull()
    const errado = await inserir(a, { proxima_data: '2999-11-15', dia: 31 })
    expect(errado.error?.message).toContain('recorrencias_dia_check')
    const fora = await inserir(a, { proxima_data: '2999-11-30', dia: 30, frequencia: 'semanal' })
    expect(fora.error?.message).toContain('recorrencias_frequencia_check')
  })

  it('o nome é obrigatório e o valor positivo', async () => {
    const semNome = await inserir(a, { descricao: '' })
    expect(semNome.error?.message).toContain('recorrencias_descricao_check')
    const zero = await inserir(a, { valor_centavos: 0 })
    expect(zero.error?.message).toContain('recorrencias_valor_check')
  })

  it('uma conta ou categoria usada numa recorrência não se apaga', async () => {
    const { data: conta } = await a.client
      .from('accounts')
      .insert({ nome: `Poupança ${crypto.randomUUID().slice(0, 8)}`, tipo: 'poupanca' })
      .select('id')
      .single()
    await criar(a, { account_id: conta!.id, proxima_data: diasDepois(10) })
    const { error } = await a.client.from('accounts').delete().eq('id', conta!.id)
    expect(error?.message).toContain('recorrencias_account_fk')
  })
})

describe('gerar_recorrencias', () => {
  it('cria o lançamento de hoje uma só vez e avança a próxima data', async () => {
    const hoje = hojeUtc()
    const rec = await criar(a, { descricao: 'Ginásio', valor_centavos: 9990 })

    const { data: criadas, error } = await gerar(a)
    expect(error).toBeNull()
    expect(criadas).toBeGreaterThanOrEqual(1)
    const [lancamento, ...resto] = await lancamentos(a, rec.id)
    expect(resto).toEqual([])
    expect(lancamento).toMatchObject({
      account_id: refsA.conta,
      category_id: refsA.despesa,
      tipo: 'despesa',
      valor_centavos: 9990,
      data: hoje,
      descricao: 'Ginásio',
    })
    expect((await recorrencia(a, rec.id)).proxima_data).toBe(
      nextOccurrence(hoje, 'mensal', diaDe(hoje)),
    )

    // Segunda chamada: nada de novo
    await gerar(a)
    expect(await lancamentos(a, rec.id)).toHaveLength(1)
  })

  it('não cria lançamentos futuros', async () => {
    const rec = await criar(a, { proxima_data: diasDepois(3) })
    await gerar(a)
    expect(await lancamentos(a, rec.id)).toEqual([])
    expect((await recorrencia(a, rec.id)).proxima_data).toBe(diasDepois(3))
  })

  it('cria os que faltaram (app fechada) com as datas certas, também com dia 31', async () => {
    const rec = await criar(a, { descricao: 'Renda', proxima_data: diasDepois(40) })
    const inicio = `${mesesAtras(4).slice(0, 8)}${'31'}`
    // O dia 31 nem sempre existe: começa no último dia desse mês
    const ultimo = new Date(Date.UTC(Number(inicio.slice(0, 4)), Number(inicio.slice(5, 7)), 0))
    const primeira = ultimo.toISOString().slice(0, 10)
    await recuar(rec.id, primeira, 31)

    await gerar(a)
    const esperadas = occurrencesUntil(primeira, 'mensal', 31, hojeUtc())
    expect((await lancamentos(a, rec.id)).map((t) => t.data)).toEqual(esperadas)
    const depois = await recorrencia(a, rec.id)
    expect(depois.proxima_data).toBe(nextOccurrence(esperadas.at(-1)!, 'mensal', 31))
    expect(depois.proxima_data > hojeUtc()).toBe(true)
  })

  it('anual: um por ano', async () => {
    const rec = await criar(a, {
      descricao: 'Seguro',
      frequencia: 'anual',
      proxima_data: diasDepois(9),
    })
    const haDoisAnos = `${Number(hojeUtc().slice(0, 4)) - 2}${hojeUtc().slice(4, 8)}01`
    await recuar(rec.id, haDoisAnos, 1)
    await gerar(a)
    expect((await lancamentos(a, rec.id)).map((t) => t.data)).toEqual(
      occurrencesUntil(haDoisAnos, 'anual', 1, hojeUtc()),
    )
  })

  it('pausada não gera', async () => {
    const rec = await criar(a, { descricao: 'Pausada', proxima_data: diasDepois(9) })
    await recuar(rec.id, mesesAtras(1))
    await a.client.from('recorrencias').update({ ativa: false }).eq('id', rec.id)
    await gerar(a)
    expect(await lancamentos(a, rec.id)).toEqual([])
  })

  it('receita numa conta: entra como receita', async () => {
    const rec = await criar(a, {
      descricao: 'Salário',
      tipo: 'receita',
      category_id: refsA.receita,
      valor_centavos: 500000,
    })
    await gerar(a)
    const [salario] = await lancamentos(a, rec.id)
    expect(salario).toMatchObject({ tipo: 'receita', valor_centavos: 500000 })
  })

  it('no cartão: compra à vista na fatura da data, ligada à recorrência', async () => {
    const cartao = await criarCartao(a)
    const rec = await criar(a, {
      account_id: cartao,
      descricao: 'Spotify',
      proxima_data: diasDepois(9),
    })
    const data = mesesAtras(1)
    await recuar(rec.id, data)

    await gerar(a)
    const parcelas = await lancamentos(a, rec.id)
    expect(parcelas.map((t) => t.data)).toEqual(occurrencesUntil(data, 'mensal', 10, hojeUtc()))
    const [primeira] = parcelas
    expect(primeira).toMatchObject({ tipo: 'despesa', valor_centavos: 5590, parcela_numero: 1 })

    const { data: compra } = await a.client
      .from('compras_cartao')
      .select('*')
      .eq('id', primeira.compra_id!)
      .single()
    expect(compra).toMatchObject({ parcelas: 1, valor_total_centavos: 5590, data_compra: data })
    const { data: fatura } = await a.client
      .from('faturas')
      .select('mes_referencia')
      .eq('id', primeira.fatura_id!)
      .single()
    expect(fatura!.mes_referencia).toBe(
      `${invoiceForPurchase({ diaFechamento: 25, diaVencimento: 5 }, data)}-01`,
    )
  })

  it('apagar a recorrência mantém os lançamentos já criados', async () => {
    const rec = await criar(a, { descricao: 'Para apagar' })
    await gerar(a)
    const [lancamento] = await lancamentos(a, rec.id)
    const { error } = await a.client.from('recorrencias').delete().eq('id', rec.id)
    expect(error).toBeNull()
    const { data: ficou } = await a.client
      .from('transactions')
      .select('id, recorrencia_id')
      .eq('id', lancamento.id)
      .single()
    expect(ficou).toEqual({ id: lancamento.id, recorrencia_id: null })
  })

  it('uma falha (categoria arquivada) fica registada e não trava as outras', async () => {
    const { data: categoria } = await a.client
      .from('categories')
      .insert({ nome: `Arquivar ${crypto.randomUUID().slice(0, 8)}`, tipo: 'despesa' })
      .select('id')
      .single()
    const falha = await criar(a, { descricao: 'Vai falhar', category_id: categoria!.id })
    const boa = await criar(a, { descricao: 'Vai passar' })
    await a.client.from('categories').update({ arquivada: true }).eq('id', categoria!.id)

    const { error } = await gerar(a)
    expect(error).toBeNull()
    expect(await lancamentos(a, falha.id)).toEqual([])
    expect(await lancamentos(a, boa.id)).toHaveLength(1)
    const depois = await recorrencia(a, falha.id)
    expect(depois).toMatchObject({ falha: 'recorrencias_arquivada_check', falha_data: hojeUtc() })
    expect(depois.proxima_data > hojeUtc()).toBe(true)

    // A pessoa dispensa o aviso
    const { error: limpar } = await a.client
      .from('recorrencias')
      .update({ falha: null, falha_data: null })
      .eq('id', falha.id)
    expect(limpar).toBeNull()
  })

  it('duas chamadas ao mesmo tempo não duplicam lançamentos', async () => {
    const rec = await criar(a, { descricao: 'Simultânea', proxima_data: diasDepois(9) })
    await recuar(rec.id, mesesAtras(3))
    const resultados = await Promise.all([gerar(a), gerar(a), gerar(a)])
    for (const { error } of resultados) expect(error).toBeNull()
    const datas = (await lancamentos(a, rec.id)).map((t) => t.data)
    expect(datas).toEqual(occurrencesUntil(mesesAtras(3), 'mensal', 10, hojeUtc()))
  })

  it('recusa uma data de hoje muito diferente da do servidor', async () => {
    const { error } = await gerar(a, diasDepois(5))
    expect(error?.hint).toBe('recorrencias_hoje_check')
  })
})

describe('recorrencia_seguinte (SQL) = nextOccurrence (TS)', () => {
  it('em todos os dias de 2027–2028, dias pedidos 1–31, mensal e anual', async () => {
    const casos = await withLocalDb(async (db) => {
      const { rows } = await db.query<{
        data: string
        frequencia: Frequency
        dia: number
        seguinte: string
      }>(`
        select d::date::text as data, f as frequencia, dia,
          public.recorrencia_seguinte(d::date, f, dia)::text as seguinte
        from generate_series(date '2027-01-01', date '2028-12-31', interval '1 day') d,
          unnest(array['mensal', 'anual']) f,
          generate_series(1, 31) dia
        where extract(day from d) <= dia
      `)
      return rows
    })
    expect(casos.length).toBeGreaterThan(20000)
    const diferentes = casos.filter(
      (caso) => nextOccurrence(caso.data, caso.frequencia, caso.dia) !== caso.seguinte,
    )
    expect(diferentes).toEqual([])
  })
})

async function criarCartao(user: TestUser) {
  const { data, error } = await user.client
    .from('accounts')
    .insert({
      nome: `Cartão ${crypto.randomUUID().slice(0, 8)}`,
      tipo: 'cartao_credito',
      dia_fechamento: 25,
      dia_vencimento: 5,
      limite_centavos: 1_000_000,
      conta_pagamento_id: refsDe(user).conta,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}
