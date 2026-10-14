import { beforeAll, describe, expect, it } from 'vitest'
import { anonClient, twoUsers, type Client, type TestUser } from './helpers'

let a: TestUser
let b: TestUser
let alimA: string
let alimB: string
let salarioB: string
let orcamentoDeA: string

const categoria = async (client: Client, nome: string) =>
  (await client.from('categories').select('id').eq('nome', nome).single()).data!.id

beforeAll(async () => {
  ;({ a, b } = await twoUsers())
  ;[alimA, alimB, salarioB] = await Promise.all([
    categoria(a.client, 'Alimentação'),
    categoria(b.client, 'Alimentação'),
    categoria(b.client, 'Salário'),
  ])
  const { data, error } = await a.client
    .from('budgets')
    .insert({ category_id: alimA, mes: '2026-10-01', limite_centavos: 50000 })
    .select('id')
    .single()
  if (error) throw error
  orcamentoDeA = data.id
})

describe('budgets — isolamento', () => {
  it('B não vê orçamentos de A', async () => {
    const { data } = await b.client.from('budgets').select('*').eq('id', orcamentoDeA)
    expect(data).toEqual([])
  })

  it('B não cria orçamentos em nome de A nem para categorias de A', async () => {
    const emNomeDeA = await b.client
      .from('budgets')
      .insert({ user_id: a.id, category_id: alimA, mes: '2026-10-01', limite_centavos: 1 })
    expect(emNomeDeA.error?.code).toBe('42501')
    const categoriaDeA = await b.client
      .from('budgets')
      .insert({ category_id: alimA, mes: '2026-10-01', limite_centavos: 1 })
    expect(categoriaDeA.error?.code).toBe('23503')
  })

  it('B não altera nem apaga orçamentos de A', async () => {
    const alterar = await b.client
      .from('budgets')
      .update({ limite_centavos: 1 })
      .eq('id', orcamentoDeA)
      .select()
    expect(alterar.data).toEqual([])
    const apagar = await b.client.from('budgets').delete().eq('id', orcamentoDeA).select()
    expect(apagar.data).toEqual([])
    const { data } = await a.client
      .from('budgets')
      .select('limite_centavos')
      .eq('id', orcamentoDeA)
      .single()
    expect(data?.limite_centavos).toBe(50000)
  })

  it('sem sessão não há acesso', async () => {
    const { error } = await anonClient().from('budgets').select('*')
    expect(error?.code).toBe('42501')
  })
})

describe('budgets — regras de dados', () => {
  it('um orçamento por categoria e mês', async () => {
    const primeiro = await b.client
      .from('budgets')
      .insert({ category_id: alimB, mes: '2026-10-01', limite_centavos: 1000 })
    expect(primeiro.error).toBeNull()
    const repetido = await b.client
      .from('budgets')
      .insert({ category_id: alimB, mes: '2026-10-01', limite_centavos: 2000 })
    expect(repetido.error?.code).toBe('23505')
    const outroMes = await b.client
      .from('budgets')
      .insert({ category_id: alimB, mes: '2026-11-01', limite_centavos: 2000 })
    expect(outroMes.error).toBeNull()
  })

  it('só categorias de despesa', async () => {
    const { error } = await b.client
      .from('budgets')
      .insert({ category_id: salarioB, mes: '2026-10-01', limite_centavos: 1000 })
    expect(error?.code).toBe('23514')
  })

  it.each([
    ['limite zero', { limite_centavos: 0 }],
    ['limite negativo', { limite_centavos: -1 }],
    ['mês que não começa no dia 1', { mes: '2026-12-15' }],
  ])('recusa %s', async (_caso, valores) => {
    const { error } = await b.client
      .from('budgets')
      .insert({ category_id: alimB, mes: '2027-01-01', limite_centavos: 100, ...valores })
    expect(error?.code).toBe('23514')
  })

  it('só o limite pode ser alterado', async () => {
    const { data: orcamento } = await b.client
      .from('budgets')
      .select('id')
      .eq('mes', '2026-10-01')
      .single()
    const limite = await b.client
      .from('budgets')
      .update({ limite_centavos: 7777 })
      .eq('id', orcamento!.id)
      .select('limite_centavos')
      .single()
    expect(limite.data?.limite_centavos).toBe(7777)
    for (const patch of [{ mes: '2026-09-01' }, { category_id: salarioB }, { user_id: a.id }]) {
      const { error } = await b.client.from('budgets').update(patch).eq('id', orcamento!.id)
      expect(error?.code).toBe('42501')
    }
  })

  it('copiar (upsert com ignoreDuplicates) cria os que faltam e nunca substitui limites existentes', async () => {
    const moradia = await categoria(b.client, 'Moradia')
    await b.client.from('budgets').insert([
      { category_id: moradia, mes: '2027-03-01', limite_centavos: 300 },
      { category_id: alimB, mes: '2027-03-01', limite_centavos: 400 },
      { category_id: alimB, mes: '2027-04-01', limite_centavos: 999 }, // já definido no destino
    ])
    // Mesma consulta que copyBudgets() faz
    const { data, error } = await b.client
      .from('budgets')
      .upsert(
        [
          { category_id: moradia, mes: '2027-04-01', limite_centavos: 300 },
          { category_id: alimB, mes: '2027-04-01', limite_centavos: 400 },
        ],
        { onConflict: 'user_id,category_id,mes', ignoreDuplicates: true },
      )
      .select('id')
    expect(error).toBeNull()
    expect(data).toHaveLength(1) // só a Moradia foi criada

    const { data: abril } = await b.client
      .from('budgets')
      .select('category_id, limite_centavos')
      .eq('mes', '2027-04-01')
    expect(abril?.find((x) => x.category_id === alimB)?.limite_centavos).toBe(999)
    expect(abril?.find((x) => x.category_id === moradia)?.limite_centavos).toBe(300)
  })

  it('B não consegue copiar para categorias de A através do upsert', async () => {
    const { error } = await b.client
      .from('budgets')
      .upsert([{ category_id: alimA, mes: '2027-05-01', limite_centavos: 1 }], {
        onConflict: 'user_id,category_id,mes',
        ignoreDuplicates: true,
      })
    expect(error?.code).toBe('23503')
  })

  it('apagar a categoria apaga os seus orçamentos', async () => {
    const { data: nova } = await b.client
      .from('categories')
      .insert({ nome: 'Temporária', tipo: 'despesa' })
      .select('id')
      .single()
    await b.client
      .from('budgets')
      .insert({ category_id: nova!.id, mes: '2026-10-01', limite_centavos: 100 })
    const { error } = await b.client.from('categories').delete().eq('id', nova!.id)
    expect(error).toBeNull()
    const { data } = await b.client.from('budgets').select('id').eq('category_id', nova!.id)
    expect(data).toEqual([])
  })
})
