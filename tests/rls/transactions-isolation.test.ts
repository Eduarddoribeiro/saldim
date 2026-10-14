import { beforeAll, describe, expect, it } from 'vitest'
import {
  anonClient,
  createTestUser,
  twoUsers,
  withLocalDb,
  type Client,
  type TestUser,
} from './helpers'

let a: TestUser
let b: TestUser
type Refs = { conta: string; despesa: string; receita: string }
let refsA: Refs
let refsB: Refs
let transacaoDeA: string

/** Ids da conta inicial e de uma categoria de cada tipo do utilizador. */
async function refs(client: Client): Promise<Refs> {
  const [{ data: conta }, { data: despesa }, { data: receita }] = await Promise.all([
    client.from('accounts').select('id').limit(1).single(),
    client.from('categories').select('id').eq('nome', 'Alimentação').single(),
    client.from('categories').select('id').eq('nome', 'Salário').single(),
  ])
  return { conta: conta!.id, despesa: despesa!.id, receita: receita!.id }
}

beforeAll(async () => {
  ;({ a, b } = await twoUsers())
  ;[refsA, refsB] = await Promise.all([refs(a.client), refs(b.client)])
  const { data, error } = await a.client
    .from('transactions')
    .insert({
      account_id: refsA.conta,
      category_id: refsA.despesa,
      tipo: 'despesa',
      valor_centavos: 4250,
      data: '2026-10-01',
      descricao: 'Jantar de A',
    })
    .select('id')
    .single()
  if (error) throw error
  transacaoDeA = data.id
})

describe('transactions — isolamento', () => {
  it('B não vê transações de A (nem pelo id)', async () => {
    const { data } = await b.client.from('transactions').select('*').eq('id', transacaoDeA)
    expect(data).toEqual([])
  })

  it('B não cria transações em nome de A', async () => {
    const { error } = await b.client.from('transactions').insert({
      user_id: a.id,
      account_id: refsA.conta,
      category_id: refsA.despesa,
      tipo: 'despesa',
      valor_centavos: 100,
    })
    expect(error?.code).toBe('42501')
  })

  it('B não usa a conta de A numa transação sua (FK composta)', async () => {
    const { error } = await b.client.from('transactions').insert({
      account_id: refsA.conta,
      category_id: refsB.despesa,
      tipo: 'despesa',
      valor_centavos: 100,
    })
    expect(error?.code).toBe('23503')
  })

  it('B não usa a categoria de A numa transação sua (FK composta)', async () => {
    const { error } = await b.client.from('transactions').insert({
      account_id: refsB.conta,
      category_id: refsA.despesa,
      tipo: 'despesa',
      valor_centavos: 100,
    })
    expect(error?.code).toBe('23503')
  })

  it('o erro é igual para um id que não existe (não revela contas alheias)', async () => {
    const inexistente = await b.client.from('transactions').insert({
      account_id: crypto.randomUUID(),
      category_id: refsB.despesa,
      tipo: 'despesa',
      valor_centavos: 100,
    })
    expect(inexistente.error?.code).toBe('23503')
  })

  it('B não move uma transação sua para a conta de A', async () => {
    const { data: propria } = await b.client
      .from('transactions')
      .insert({
        account_id: refsB.conta,
        category_id: refsB.despesa,
        tipo: 'despesa',
        valor_centavos: 100,
      })
      .select('id')
      .single()
    const { error } = await b.client
      .from('transactions')
      .update({ account_id: refsA.conta })
      .eq('id', propria!.id)
    expect(error?.code).toBe('23503')
  })

  it('B não altera nem apaga transações de A', async () => {
    const alterar = await b.client
      .from('transactions')
      .update({ valor_centavos: 1 })
      .eq('id', transacaoDeA)
      .select()
    expect(alterar.data).toEqual([])
    const apagar = await b.client.from('transactions').delete().eq('id', transacaoDeA).select()
    expect(apagar.data).toEqual([])

    const { data } = await a.client
      .from('transactions')
      .select('valor_centavos')
      .eq('id', transacaoDeA)
      .single()
    expect(data?.valor_centavos).toBe(4250)
  })

  it('sem sessão não há acesso', async () => {
    const { error } = await anonClient().from('transactions').select('*')
    expect(error?.code).toBe('42501')
  })
})

describe('transactions — regras de dados', () => {
  const base = () => ({
    account_id: refsB.conta,
    category_id: refsB.despesa,
    tipo: 'despesa' as const,
    valor_centavos: 1000,
  })

  it('user_id e data têm valores por omissão (utilizador da sessão, hoje)', async () => {
    const { data } = await b.client
      .from('transactions')
      .insert(base())
      .select('user_id, data, descricao')
      .single()
    expect(data?.user_id).toBe(b.id)
    expect(data?.data).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(data?.descricao).toBe('')
  })

  it.each([
    ['valor zero', { valor_centavos: 0 }],
    ['valor negativo', { valor_centavos: -100 }],
    ['valor acima do máximo', { valor_centavos: 100_000_000_000 }],
    ['descrição com mais de 120 caracteres', { descricao: 'x'.repeat(121) }],
    ['descrição com espaços nas pontas', { descricao: ' café ' }],
    ['data absurda', { data: '1800-01-01' }],
  ])('recusa %s', async (_caso, valores) => {
    const { error } = await b.client.from('transactions').insert({ ...base(), ...valores })
    expect(error?.code).toBe('23514')
  })

  it('a categoria tem de ser do mesmo tipo da transação', async () => {
    const receitaEmDespesa = await b.client
      .from('transactions')
      .insert({ ...base(), tipo: 'receita' }) // categoria Alimentação é de despesa
    expect(receitaEmDespesa.error?.code).toBe('23514')

    const certa = await b.client
      .from('transactions')
      .insert({ ...base(), tipo: 'receita', category_id: refsB.receita })
    expect(certa.error).toBeNull()
  })

  it('mudar só o tipo de uma transação para não coincidir com a categoria é recusado', async () => {
    const { data: t } = await b.client.from('transactions').insert(base()).select('id').single()
    const { error } = await b.client
      .from('transactions')
      .update({ tipo: 'receita' })
      .eq('id', t!.id)
    expect(error?.code).toBe('23514')
  })

  it('o dono e a data de criação não podem ser alterados', async () => {
    const { data: t } = await b.client.from('transactions').insert(base()).select('id').single()
    for (const patch of [{ user_id: a.id }, { created_at: '2000-01-01' }]) {
      const { error } = await b.client.from('transactions').update(patch).eq('id', t!.id)
      expect(error?.code).toBe('42501')
    }
  })

  it('não se apaga uma conta ou categoria que tenha transações', async () => {
    const conta = await b.client.from('accounts').delete().eq('id', refsB.conta)
    expect(conta.error?.code).toBe('23503')
    const categoria = await b.client.from('categories').delete().eq('id', refsB.despesa)
    expect(categoria.error?.code).toBe('23503')
  })

  it('apagar o utilizador apaga em cascata transações, contas e categorias (FKs NO ACTION)', async () => {
    const temp = await createTestUser('apagar')
    const r = await refs(temp.client)
    await temp.client
      .from('transactions')
      .insert({ account_id: r.conta, category_id: r.despesa, tipo: 'despesa', valor_centavos: 1 })

    const restantes = await withLocalDb(async (db) => {
      await db.query('delete from auth.users where id = $1', [temp.id])
      const { rows } = await db.query(
        `select (select count(*) from public.transactions where user_id = $1)
              + (select count(*) from public.accounts where user_id = $1)
              + (select count(*) from public.categories where user_id = $1)
              + (select count(*) from public.profiles where id = $1) as total`,
        [temp.id],
      )
      return Number(rows[0].total)
    })
    expect(restantes).toBe(0)
  })

  it('o próprio edita e apaga as suas transações', async () => {
    const { data: t } = await b.client.from('transactions').insert(base()).select('id').single()
    const editar = await b.client
      .from('transactions')
      .update({ valor_centavos: 999, descricao: 'Corrigido', data: '2026-09-30' })
      .eq('id', t!.id)
      .select('valor_centavos, descricao, data')
      .single()
    expect(editar.data).toEqual({ valor_centavos: 999, descricao: 'Corrigido', data: '2026-09-30' })
    const apagar = await b.client.from('transactions').delete().eq('id', t!.id).select('id')
    expect(apagar.data).toHaveLength(1)
  })
})
