import { beforeAll, describe, expect, it } from 'vitest'
import {
  anonClient,
  createTestUser,
  twoUsers,
  withLocalDb,
  type Client,
  type TestUser,
} from './helpers'

// Etapa C5: transferências e pagamentos de fatura (migration transferencias).

let a: TestUser
let b: TestUser
type Refs = { principal: string; despesa: string }
let refsA: Refs
let refsB: Refs
let cartaoA: string
let faturaA: string
let transferenciaA: string

/** Hoje em UTC (o servidor compara com current_date, em UTC). */
const hojeUtc = () => new Date().toISOString().slice(0, 10)
const diasDepois = (dias: number) => {
  const data = new Date()
  data.setUTCDate(data.getUTCDate() + dias)
  return data.toISOString().slice(0, 10)
}

async function refs(client: Client): Promise<Refs> {
  const [{ data: principal }, { data: despesa }] = await Promise.all([
    client.from('accounts').select('id').eq('nome', 'Conta principal').single(),
    client.from('categories').select('id').eq('nome', 'Alimentação').single(),
  ])
  return { principal: principal!.id, despesa: despesa!.id }
}

async function criarConta(user: TestUser, nome = `Banco ${crypto.randomUUID().slice(0, 8)}`) {
  const { data, error } = await user.client.from('accounts').insert({ nome }).select('id').single()
  if (error) throw error
  return data.id
}

/** Cartão com uma compra de 3 parcelas; devolve o cartão, a compra e as faturas por ordem. */
async function cartaoComCompra(user: TestUser, r: Refs) {
  const { data: cartao, error } = await user.client
    .from('accounts')
    .insert({
      nome: `Cartão ${crypto.randomUUID().slice(0, 8)}`,
      tipo: 'cartao_credito',
      dia_fechamento: 25,
      dia_vencimento: 5,
      limite_centavos: 1_000_000,
      conta_pagamento_id: r.principal,
    })
    .select('id')
    .single()
  if (error) throw error
  const { data: compra, error: erroCompra } = await user.client.rpc('registar_compra_cartao', {
    p_account_id: cartao.id,
    p_category_id: r.despesa,
    p_data_compra: '2026-09-10',
    p_valor_total_centavos: 30000,
    p_parcelas: 3,
  })
  if (erroCompra) throw erroCompra
  const { data: faturas } = await user.client
    .from('faturas')
    .select('id')
    .eq('account_id', cartao.id)
    .order('mes_referencia')
  return { cartao: cartao.id, compra: compra!, faturas: faturas!.map((f) => f.id) }
}

const pagar = (user: TestUser, origem: string, cartao: string, fatura: string, valor = 10000) =>
  user.client
    .from('transferencias')
    .insert({
      conta_origem_id: origem,
      conta_destino_id: cartao,
      fatura_id: fatura,
      valor_centavos: valor,
      data: hojeUtc(),
    })
    .select('id')
    .single()

beforeAll(async () => {
  ;({ a, b } = await twoUsers())
  ;[refsA, refsB] = await Promise.all([refs(a.client), refs(b.client)])
  const doA = await cartaoComCompra(a, refsA)
  cartaoA = doA.cartao
  faturaA = doA.faturas[0]
  const { data, error } = await pagar(a, refsA.principal, cartaoA, faturaA)
  if (error) throw error
  transferenciaA = data.id
})

describe('transferências — isolamento (RLS)', () => {
  it('B não vê nem apaga as transferências de A', async () => {
    expect(
      (await b.client.from('transferencias').select('id').eq('id', transferenciaA)).data,
    ).toEqual([])
    const { data } = await b.client
      .from('transferencias')
      .delete()
      .eq('id', transferenciaA)
      .select()
    expect(data).toEqual([])
    expect(
      (await a.client.from('transferencias').select('id').eq('id', transferenciaA)).data,
    ).toHaveLength(1)
  })

  it('B não transfere de nem para contas de A (erro igual ao de um id inexistente)', async () => {
    const bancoB = await criarConta(b)
    for (const [origem, destino] of [
      [refsA.principal, bancoB],
      [bancoB, refsA.principal],
      [crypto.randomUUID(), bancoB],
    ]) {
      const { error } = await b.client
        .from('transferencias')
        .insert({ conta_origem_id: origem, conta_destino_id: destino, valor_centavos: 100 })
      expect(error?.code, `${origem} → ${destino}`).toBe('23503')
    }
  })

  it('B não paga a fatura de A, nem com o seu próprio cartão como destino', async () => {
    const doB = await cartaoComCompra(b, refsB)
    const { error } = await pagar(b, refsB.principal, doB.cartao, faturaA)
    expect(error?.code).toBe('23503')
    const paraOCartaoDeA = await pagar(b, refsB.principal, cartaoA, faturaA)
    expect(paraOCartaoDeA.error?.code).toBe('23503')
  })

  it('anon não lê nem cria transferências', async () => {
    const anon = anonClient()
    const ler = await anon.from('transferencias').select('id')
    expect(ler.error?.code).toBe('42501')
    const criar = await anon
      .from('transferencias')
      .insert({ conta_origem_id: refsA.principal, conta_destino_id: cartaoA, valor_centavos: 1 })
    expect(criar.error?.code).toBe('42501')
  })
})

describe('transferências — regras', () => {
  it('uma transferência entre contas de dinheiro é aceite (também com data futura)', async () => {
    const poupanca = await criarConta(b)
    for (const data of [hojeUtc(), '2030-01-01']) {
      const { error } = await b.client.from('transferencias').insert({
        conta_origem_id: refsB.principal,
        conta_destino_id: poupanca,
        valor_centavos: 5000,
        data,
        descricao: 'Para a poupança',
      })
      expect(error, data).toBeNull()
    }
  })

  it('valores inválidos, a mesma conta nos dois lados e descrições inválidas são recusados', async () => {
    const poupanca = await criarConta(b)
    const base = {
      conta_origem_id: refsB.principal,
      conta_destino_id: poupanca,
      valor_centavos: 100,
    }
    for (const linha of [
      { ...base, valor_centavos: 0 },
      { ...base, valor_centavos: -1 },
      { ...base, valor_centavos: 100_000_000_000 },
      { ...base, conta_destino_id: refsB.principal },
      { ...base, data: '3000-01-01' },
      { ...base, descricao: ' espaços ' },
    ]) {
      const { error } = await b.client.from('transferencias').insert(linha)
      expect(error?.code, JSON.stringify(linha)).toBe('23514')
    }
  })

  it('pagamento: só para o cartão da fatura, nunca a sair de um cartão, sempre com fatura', async () => {
    const doB = await cartaoComCompra(b, refsB)
    const outro = await cartaoComCompra(b, refsB)

    expect((await pagar(b, refsB.principal, doB.cartao, doB.faturas[0])).error).toBeNull()
    // Pagar mais do que a fatura é permitido (fica com crédito, C6)
    expect((await pagar(b, refsB.principal, doB.cartao, doB.faturas[1], 999_999)).error).toBeNull()

    const faturaDeOutroCartao = await pagar(b, refsB.principal, doB.cartao, outro.faturas[0])
    expect(faturaDeOutroCartao.error?.code).toBe('23503')

    const semFatura = await b.client.from('transferencias').insert({
      conta_origem_id: refsB.principal,
      conta_destino_id: doB.cartao,
      valor_centavos: 100,
    })
    expect(semFatura.error?.hint).toBe('transferencias_cartao_sem_fatura_check')

    const doCartao = await b.client.from('transferencias').insert({
      conta_origem_id: doB.cartao,
      conta_destino_id: refsB.principal,
      valor_centavos: 100,
    })
    expect(doCartao.error?.hint).toBe('transferencias_origem_cartao_check')

    const deCartaoParaCartao = await pagar(b, outro.cartao, doB.cartao, doB.faturas[0])
    expect(deCartaoParaCartao.error?.hint).toBe('transferencias_origem_cartao_check')

    const contaNormalComFatura = await b.client.from('transferencias').insert({
      conta_origem_id: doB.cartao,
      conta_destino_id: refsB.principal,
      fatura_id: doB.faturas[0],
      valor_centavos: 100,
    })
    expect(contaNormalComFatura.error).not.toBeNull()
  })

  it('D10a: um pagamento não tem data futura (tolerância de 1 dia pelo fuso horário)', async () => {
    const doB = await cartaoComCompra(b, refsB)
    const base = {
      conta_origem_id: refsB.principal,
      conta_destino_id: doB.cartao,
      fatura_id: doB.faturas[0],
      valor_centavos: 100,
    }
    expect(
      (await b.client.from('transferencias').insert({ ...base, data: diasDepois(1) })).error,
    ).toBeNull()
    const futuro = await b.client.from('transferencias').insert({ ...base, data: diasDepois(2) })
    expect(futuro.error?.hint).toBe('transferencias_pagamento_futuro_check')
    expect(
      (await b.client.from('transferencias').insert({ ...base, data: '2020-01-01' })).error,
    ).toBeNull()
  })

  it('não se altera (só se apaga); o dono apaga a sua', async () => {
    const poupanca = await criarConta(b)
    const { data } = await b.client
      .from('transferencias')
      .insert({ conta_origem_id: refsB.principal, conta_destino_id: poupanca, valor_centavos: 100 })
      .select('id')
      .single()
    const alterar = await b.client
      .from('transferencias')
      .update({ valor_centavos: 1 } as never)
      .eq('id', data!.id)
    expect(alterar.error?.code).toBe('42501')
    const apagar = await b.client.from('transferencias').delete().eq('id', data!.id).select('id')
    expect(apagar.data).toHaveLength(1)
  })
})

describe('pagamentos, compras e contas', () => {
  it('D6: uma compra com parcelas numa fatura paga não se apaga; sem o pagamento, já se apaga', async () => {
    const doB = await cartaoComCompra(b, refsB)
    // Paga a fatura da 3.ª parcela: basta UMA fatura paga para bloquear a compra inteira
    const { data: pagamento } = await pagar(b, refsB.principal, doB.cartao, doB.faturas[2])
    const bloqueada = await b.client.from('compras_cartao').delete().eq('id', doB.compra)
    expect(bloqueada.error?.hint).toBe('compras_cartao_fatura_paga_check')

    await b.client.from('transferencias').delete().eq('id', pagamento!.id)
    const apagar = await b.client.from('compras_cartao').delete().eq('id', doB.compra).select('id')
    expect(apagar.error).toBeNull()
    expect(apagar.data).toHaveLength(1)
  })

  it('uma conta com transferências não se apaga nem muda para cartão', async () => {
    const banco = await criarConta(b)
    await b.client
      .from('transferencias')
      .insert({ conta_origem_id: refsB.principal, conta_destino_id: banco, valor_centavos: 100 })
    expect((await b.client.from('accounts').delete().eq('id', banco)).error?.code).toBe('23503')
    const paraCartao = await b.client
      .from('accounts')
      .update({
        tipo: 'cartao_credito',
        dia_fechamento: 25,
        dia_vencimento: 5,
        limite_centavos: 1000,
        conta_pagamento_id: refsB.principal,
      })
      .eq('id', banco)
    expect(paraCartao.error?.hint).toBe('accounts_tipo_cartao_em_uso_check')
  })

  it('apagar um utilizador com compras e pagamentos continua a funcionar', async () => {
    const c = await createTestUser('c')
    const refsC = await refs(c.client)
    const doC = await cartaoComCompra(c, refsC)
    expect((await pagar(c, refsC.principal, doC.cartao, doC.faturas[0])).error).toBeNull()

    const restantes = await withLocalDb(async (db) => {
      await db.query('delete from auth.users where id = $1', [c.id])
      return (
        await db.query<{ n: string }>(
          `select (select count(*) from public.transferencias where user_id = $1)
                + (select count(*) from public.compras_cartao where user_id = $1)
                + (select count(*) from public.faturas where user_id = $1) as n`,
          [c.id],
        )
      ).rows[0].n
    })
    expect(Number(restantes)).toBe(0)
  })
})
