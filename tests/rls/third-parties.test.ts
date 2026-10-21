import { beforeAll, describe, expect, it } from 'vitest'
import type { IsoDate } from '../../src/lib/dates'
import { anonClient, twoUsers, type Client, type TestUser } from './helpers'

// Etapa T1: compras no cartão de outras pessoas e reembolsos (migration terceiros; D19–D22).
// Isolamento entre utilizadores, a pessoa copiada para as parcelas e os estornos, e as regras.

let a: TestUser
let b: TestUser
type Refs = { conta: string; despesa: string; cartao: string }
let refsA: Refs
let refsB: Refs

const hojeUtc = (): IsoDate => new Date().toISOString().slice(0, 10)
const diasDepois = (dias: number): IsoDate => {
  const data = new Date()
  data.setUTCDate(data.getUTCDate() + dias)
  return data.toISOString().slice(0, 10)
}

async function refs(client: Client): Promise<Refs> {
  const [{ data: conta }, { data: despesa }] = await Promise.all([
    client.from('accounts').select('id').eq('nome', 'Conta principal').single(),
    client.from('categories').select('id').eq('nome', 'Alimentação').single(),
  ])
  const { data: cartao, error } = await client
    .from('accounts')
    .insert({
      nome: 'Visa',
      tipo: 'cartao_credito',
      dia_fechamento: 25,
      dia_vencimento: 5,
      limite_centavos: 1_000_000,
      conta_pagamento_id: conta!.id,
    })
    .select('id')
    .single()
  if (error) throw error
  return { conta: conta!.id, despesa: despesa!.id, cartao: cartao.id }
}

const refsDe = (user: TestUser) => (user === a ? refsA : refsB)

async function pessoa(user: TestUser, nome = `Pessoa ${crypto.randomUUID().slice(0, 8)}`) {
  const { data, error } = await user.client.from('pessoas').insert({ nome }).select('*').single()
  if (error) throw error
  return data
}

const comprar = (user: TestUser, pessoaId: string | null, parcelas = 3) =>
  user.client.rpc('registar_compra_cartao', {
    p_account_id: refsDe(user).cartao,
    p_category_id: refsDe(user).despesa,
    p_data_compra: hojeUtc(),
    p_valor_total_centavos: 30000,
    p_parcelas: parcelas,
    ...(pessoaId ? { p_pessoa_id: pessoaId } : {}),
  })

const reembolsar = (user: TestUser, pessoaId: string, extra: Record<string, unknown> = {}) =>
  user.client
    .from('reembolsos')
    .insert({
      pessoa_id: pessoaId,
      account_id: refsDe(user).conta,
      valor_centavos: 5000,
      data: hojeUtc(),
      ...extra,
    } as never)
    .select('*')
    .single()

beforeAll(async () => {
  ;({ a, b } = await twoUsers())
  ;[refsA, refsB] = await Promise.all([refs(a.client), refs(b.client)])
})

describe('pessoas e reembolsos — isolamento', () => {
  it('B não vê, não altera nem apaga as pessoas e os reembolsos de A', async () => {
    const mae = await pessoa(a, 'Mãe')
    const { data: reembolso } = await reembolsar(a, mae.id)

    expect((await b.client.from('pessoas').select('*').eq('id', mae.id)).data).toEqual([])
    expect((await b.client.from('reembolsos').select('*').eq('id', reembolso!.id)).data).toEqual([])
    const { data: alterada } = await b.client
      .from('pessoas')
      .update({ nome: 'Intrusa' })
      .eq('id', mae.id)
      .select()
    expect(alterada).toEqual([])
    const { data: apagado } = await b.client
      .from('reembolsos')
      .delete()
      .eq('id', reembolso!.id)
      .select()
    expect(apagado).toEqual([])
  })

  it('B não usa a pessoa de A numa compra nem num reembolso', async () => {
    const deA = await pessoa(a)
    const { error: compra } = await comprar(b, deA.id)
    expect(compra?.code).toBe('23503')
    const { error: reembolso } = await reembolsar(b, deA.id)
    expect(reembolso?.code).toBe('23503')
  })

  it('anon não lê nem cria', async () => {
    const anon = anonClient()
    expect((await anon.from('pessoas').select('*')).data ?? []).toEqual([])
    expect((await anon.from('reembolsos').select('*')).data ?? []).toEqual([])
    const { error } = await anon.from('pessoas').insert({ nome: 'Anónima' })
    expect(error).not.toBeNull()
  })
})

describe('compras de outra pessoa', () => {
  it('a pessoa da compra passa para todas as parcelas e para os estornos', async () => {
    const primo = await pessoa(a, 'Primo')
    const { data: compra, error } = await comprar(a, primo.id)
    expect(error).toBeNull()

    const { data: parcelas } = await a.client
      .from('transactions')
      .select('pessoa_id, parcela_numero')
      .eq('compra_id', compra!)
    expect(parcelas).toHaveLength(3)
    expect(new Set(parcelas!.map((p) => p.pessoa_id))).toEqual(new Set([primo.id]))

    const { data: estorno } = await a.client.rpc('registar_estorno_cartao', {
      p_compra_id: compra!,
      p_data: hojeUtc(),
      p_valor_centavos: 1000,
      p_descricao: 'Devolução',
    })
    const { data: lido } = await a.client
      .from('transactions')
      .select('pessoa_id')
      .eq('id', estorno!)
      .single()
    expect(lido!.pessoa_id).toBe(primo.id)
  })

  it('sem pessoa (como antes): as parcelas ficam sem pessoa', async () => {
    const { data: compra, error } = await comprar(a, null, 1)
    expect(error).toBeNull()
    const { data: parcelas } = await a.client
      .from('transactions')
      .select('pessoa_id')
      .eq('compra_id', compra!)
    expect(parcelas).toEqual([{ pessoa_id: null }])
  })

  it('uma transação normal nunca fica com pessoa (o valor enviado é ignorado)', async () => {
    const mae = await pessoa(a)
    const { data, error } = await a.client
      .from('transactions')
      .insert({
        account_id: refsA.conta,
        category_id: refsA.despesa,
        tipo: 'despesa',
        valor_centavos: 100,
        data: hojeUtc(),
        pessoa_id: mae.id,
      })
      .select('pessoa_id')
      .single()
    expect(error).toBeNull()
    expect(data!.pessoa_id).toBeNull()
  })

  it('a pessoa de uma parcela não se altera', async () => {
    const mae = await pessoa(a)
    const { data: compra } = await comprar(a, mae.id, 1)
    const { error } = await a.client
      .from('transactions')
      .update({ pessoa_id: null } as never)
      .eq('compra_id', compra!)
    expect(error).not.toBeNull()
  })

  it('uma pessoa com compras não se apaga (arquiva-se)', async () => {
    const mae = await pessoa(a)
    await comprar(a, mae.id, 1)
    const { error } = await a.client.from('pessoas').delete().eq('id', mae.id)
    expect(error?.message).toContain('compras_cartao_pessoa_fk')
    const { error: arquivar } = await a.client
      .from('pessoas')
      .update({ arquivada: true })
      .eq('id', mae.id)
    expect(arquivar).toBeNull()
  })

  it('nome único por utilizador, sem distinguir maiúsculas', async () => {
    await pessoa(a, 'Tia Rosa')
    const { error } = await a.client.from('pessoas').insert({ nome: 'tia rosa' })
    expect(error?.code).toBe('23505')
    // Outro utilizador pode ter o mesmo nome
    expect((await b.client.from('pessoas').insert({ nome: 'Tia Rosa' })).error).toBeNull()
  })
})

describe('dívida anterior (D23)', () => {
  it('guarda-se ao criar e ao editar; não pode ser negativa; B não a altera', async () => {
    const { data: criada, error } = await a.client
      .from('pessoas')
      .insert({ nome: `Avó ${crypto.randomUUID().slice(0, 8)}`, divida_anterior_centavos: 41230 })
      .select('*')
      .single()
    expect(error).toBeNull()
    expect(criada!.divida_anterior_centavos).toBe(41230)

    const { error: negativa } = await a.client
      .from('pessoas')
      .update({ divida_anterior_centavos: -1 })
      .eq('id', criada!.id)
    expect(negativa?.message).toContain('pessoas_divida_anterior_check')

    const { data: deB } = await b.client
      .from('pessoas')
      .update({ divida_anterior_centavos: 0 })
      .eq('id', criada!.id)
      .select()
    expect(deB).toEqual([])
  })
})

describe('reembolsos — regras', () => {
  it('entram numa conta de dinheiro, não num cartão', async () => {
    const mae = await pessoa(a)
    const { error } = await reembolsar(a, mae.id, { account_id: refsA.cartao })
    expect(error?.hint).toBe('reembolsos_conta_check')
  })

  it('sem data futura (1 dia de tolerância)', async () => {
    const mae = await pessoa(a)
    expect((await reembolsar(a, mae.id, { data: diasDepois(3) })).error?.hint).toBe(
      'reembolsos_futuro_check',
    )
    expect((await reembolsar(a, mae.id, { data: diasDepois(1) })).error).toBeNull()
  })

  it('valor positivo e sem alterações (apaga-se e regista-se de novo)', async () => {
    const mae = await pessoa(a)
    expect((await reembolsar(a, mae.id, { valor_centavos: 0 })).error?.code).toBe('23514')
    const { data } = await reembolsar(a, mae.id)
    const { error } = await a.client
      .from('reembolsos')
      .update({ valor_centavos: 1 } as never)
      .eq('id', data!.id)
    expect(error).not.toBeNull()
    expect((await a.client.from('reembolsos').delete().eq('id', data!.id)).error).toBeNull()
  })
})
