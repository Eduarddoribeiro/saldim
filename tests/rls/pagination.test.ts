import { beforeAll, describe, expect, it } from 'vitest'
import { fetchAllPages } from '../../src/lib/pagination'
import { createTestUser, type TestUser } from './helpers'

// Prova contra o Supabase real: um pedido simples é cortado em 1000 linhas (sem erro!), e
// fetchAllPages devolve todas — é o que garante saldos corretos com muitas transações.

const TOTAL = 1205
let user: TestUser

beforeAll(async () => {
  user = await createTestUser('paginacao')
  const [{ data: conta }, { data: categoria }] = await Promise.all([
    user.client.from('accounts').select('id').single(),
    user.client.from('categories').select('id').eq('nome', 'Alimentação').single(),
  ])
  const rows = Array.from({ length: TOTAL }, (_, index) => ({
    account_id: conta!.id,
    category_id: categoria!.id,
    tipo: 'despesa' as const,
    valor_centavos: 1,
    data: `2026-01-${String((index % 28) + 1).padStart(2, '0')}`,
  }))
  const { error } = await user.client.from('transactions').insert(rows)
  if (error) throw error
}, 60_000)

describe('limite de linhas do Supabase', () => {
  it('um pedido simples devolve só 1000 linhas, sem erro', async () => {
    const { data, error } = await user.client.from('transactions').select('id')
    expect(error).toBeNull()
    expect(data).toHaveLength(1000)
  })

  it('fetchAllPages devolve todas as linhas, sem repetidas', async () => {
    const { data, error } = await fetchAllPages((from, to) =>
      user.client
        .from('transactions')
        .select('id, valor_centavos')
        .order('data')
        .order('id')
        .range(from, to),
    )
    expect(error).toBeNull()
    expect(data).toHaveLength(TOTAL)
    expect(new Set(data.map((row) => row.id)).size).toBe(TOTAL)
    expect(data.reduce((sum, row) => sum + row.valor_centavos, 0)).toBe(TOTAL)
  })
})
