import { beforeAll, describe, expect, it } from 'vitest'
import { anonClient, twoUsers, type TestUser } from './helpers'

let a: TestUser
let b: TestUser
let contaDeA: string

beforeAll(async () => {
  ;({ a, b } = await twoUsers())
  const { data, error } = await a.client
    .from('accounts')
    .insert({ nome: 'Banco de A', saldo_inicial_centavos: 100000 })
    .select('id')
    .single()
  if (error) throw error
  contaDeA = data.id
})

describe('conta inicial', () => {
  it('cada utilizador novo recebe a "Conta principal" (corrente, saldo 0)', async () => {
    const { data } = await b.client.from('accounts').select('nome, tipo, saldo_inicial_centavos')
    expect(data).toEqual([{ nome: 'Conta principal', tipo: 'corrente', saldo_inicial_centavos: 0 }])
  })
})

describe('accounts — isolamento', () => {
  it('B não vê contas de A (nem pelo id)', async () => {
    const porId = await b.client.from('accounts').select('*').eq('id', contaDeA)
    expect(porId.data).toEqual([])
    const todas = await b.client.from('accounts').select('user_id')
    expect(todas.data?.every((conta) => conta.user_id === b.id)).toBe(true)
  })

  it('B não cria contas em nome de A', async () => {
    const { error } = await b.client.from('accounts').insert({ nome: 'Intrusa', user_id: a.id })
    expect(error?.code).toBe('42501')
  })

  it('B não altera nem apaga contas de A', async () => {
    const alterar = await b.client
      .from('accounts')
      .update({ saldo_inicial_centavos: 0 })
      .eq('id', contaDeA)
      .select()
    expect(alterar.data).toEqual([])
    const apagar = await b.client.from('accounts').delete().eq('id', contaDeA).select()
    expect(apagar.data).toEqual([])

    const { data } = await a.client
      .from('accounts')
      .select('saldo_inicial_centavos')
      .eq('id', contaDeA)
      .single()
    expect(data?.saldo_inicial_centavos).toBe(100000)
  })

  it('sem sessão não há acesso', async () => {
    const { error } = await anonClient().from('accounts').select('*')
    expect(error?.code).toBe('42501')
  })
})

describe('accounts — regras de dados', () => {
  it('saldo inicial negativo é permitido; acima do limite não', async () => {
    const negativo = await b.client
      .from('accounts')
      .insert({ nome: 'A descoberto', saldo_inicial_centavos: -5000 })
      .select('saldo_inicial_centavos')
      .single()
    expect(negativo.data?.saldo_inicial_centavos).toBe(-5000)

    const excessivo = await b.client
      .from('accounts')
      .insert({ nome: 'Excessiva', saldo_inicial_centavos: 100_000_000_000 })
    expect(excessivo.error?.code).toBe('23514')
  })

  it('nome único por utilizador, sem distinguir maiúsculas', async () => {
    const { error } = await b.client.from('accounts').insert({ nome: 'conta principal' })
    expect(error?.code).toBe('23505')
    // Outro utilizador pode usar o mesmo nome
    const deA = await a.client.from('accounts').insert({ nome: 'A descoberto' })
    expect(deA.error).toBeNull()
  })

  it('o dono e a data de criação não podem ser alterados', async () => {
    const { data: conta } = await b.client.from('accounts').select('id').limit(1).single()
    for (const patch of [{ user_id: a.id }, { created_at: '2000-01-01' }]) {
      const { error } = await b.client.from('accounts').update(patch).eq('id', conta!.id)
      expect(error?.code).toBe('42501')
    }
  })

  it('tipo fora do enum é recusado', async () => {
    const { error } = await b.client
      .from('accounts')
      // @ts-expect-error — de propósito: valor que não existe no enum tipo_conta
      .insert({ nome: 'Tipo mau', tipo: 'cartao' })
    expect(error?.code).toBe('22P02') // invalid_text_representation (valor de enum inválido)
  })

  it('o próprio edita o nome, tipo, saldo inicial e arquiva', async () => {
    const { data: conta } = await b.client
      .from('accounts')
      .select('id')
      .eq('nome', 'A descoberto')
      .single()
    const { data, error } = await b.client
      .from('accounts')
      .update({ nome: 'Banco X', tipo: 'poupanca', saldo_inicial_centavos: 1, arquivada: true })
      .eq('id', conta!.id)
      .select('nome, tipo, saldo_inicial_centavos, arquivada')
      .single()
    expect(error).toBeNull()
    expect(data).toEqual({
      nome: 'Banco X',
      tipo: 'poupanca',
      saldo_inicial_centavos: 1,
      arquivada: true,
    })
  })
})
