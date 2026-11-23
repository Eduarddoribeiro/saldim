import { beforeAll, describe, expect, it } from 'vitest'
import { halfSplit, splitInstallments } from '../../src/lib/credit-card'
import { twoUsers, type TestUser } from './helpers'

// Compra dividida (migration compra_dividida): duas compras, a minha e a da pessoa, na mesma
// transação; as parcelas das duas somam as parcelas do total, como o banco cobra.

let a: TestUser
let b: TestUser
let cartao: string
let despesa: string
let mae: string

beforeAll(async () => {
  ;({ a, b } = await twoUsers())
  const [{ data: conta }, { data: categoria }] = await Promise.all([
    a.client.from('accounts').select('id').eq('nome', 'Conta principal').single(),
    a.client.from('categories').select('id').eq('nome', 'Alimentação').single(),
  ])
  despesa = categoria!.id
  const { data: card, error } = await a.client
    .from('accounts')
    .insert({
      nome: 'Picpay',
      tipo: 'cartao_credito',
      dia_fechamento: 9,
      dia_vencimento: 15,
      limite_centavos: 1_000_000,
      conta_pagamento_id: conta!.id,
    })
    .select('id')
    .single()
  if (error) throw error
  cartao = card.id
  const { data: pessoa } = await a.client
    .from('pessoas')
    .insert({ nome: 'Mãe' })
    .select('id')
    .single()
  mae = pessoa!.id
})

const dividir = (user: TestUser, extra: Record<string, unknown> = {}) => {
  const { minha, pessoa } = halfSplit(6666, 2)
  return user.client.rpc('registar_compra_dividida', {
    p_account_id: cartao,
    p_category_id: despesa,
    p_data_compra: '2026-11-17',
    p_valor_meu_centavos: minha,
    p_valor_pessoa_centavos: pessoa,
    p_parcelas: 2,
    p_pessoa_id: mae,
    p_descricao: 'Café',
    ...extra,
  } as never)
}

describe('registar_compra_dividida', () => {
  it('grava a minha compra e a da pessoa; em cada fatura as parcelas somam a do banco', async () => {
    const { data: ids, error } = await dividir(a)
    expect(error).toBeNull()
    expect(ids).toHaveLength(2)
    const { data: compras } = await a.client
      .from('compras_cartao')
      .select('id, valor_total_centavos, pessoa_id, descricao')
      .in('id', ids as string[])
    expect(compras?.map((c) => [c.valor_total_centavos, c.pessoa_id, c.descricao]).sort()).toEqual(
      [
        [3332, null, 'Café'],
        [3334, mae, 'Café'],
      ].sort(),
    )
    const { data: parcelas } = await a.client
      .from('transactions')
      .select('fatura_id, valor_centavos, parcela_numero')
      .in('compra_id', ids as string[])
    const porParcela = [1, 2].map((n) =>
      (parcelas ?? [])
        .filter((p) => p.parcela_numero === n)
        .reduce((sum, p) => sum + p.valor_centavos, 0),
    )
    expect(porParcela).toEqual(splitInstallments(6666, 2))
  })

  it('ou ficam as duas, ou nenhuma: uma parte inválida desfaz a outra', async () => {
    const antes = (await a.client.from('compras_cartao').select('id')).data?.length
    // A parte da pessoa com 1 centavo não chega para 2 parcelas: a 2.ª compra falha
    const { error } = await dividir(a, { p_valor_pessoa_centavos: 1 })
    expect(error).not.toBeNull()
    expect((await a.client.from('compras_cartao').select('id')).data?.length).toBe(antes)
  })

  it('sem pessoa é recusada; outro utilizador não usa o cartão nem a pessoa de A', async () => {
    expect((await dividir(a, { p_pessoa_id: null })).error?.hint).toBe(
      'compra_dividida_pessoa_check',
    )
    expect((await dividir(b)).error).not.toBeNull()
    expect((await b.client.from('compras_cartao').select('id')).data).toEqual([])
  })
})
