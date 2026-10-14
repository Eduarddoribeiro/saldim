import { describe, expect, it, vi } from 'vitest'
import { fetchAllPages } from './pagination'

/** Simula uma tabela com `total` linhas que devolve fatias como o PostgREST faz com .range(). */
function fakeTable(total: number) {
  const rows = Array.from({ length: total }, (_, index) => index)
  return vi.fn(async (from: number, to: number) => ({
    data: rows.slice(from, to + 1),
    error: null,
  }))
}

describe('fetchAllPages', () => {
  it('junta várias páginas até a última vir incompleta', async () => {
    const page = fakeTable(2500)
    const { data, error } = await fetchAllPages(page, 1000)
    expect(error).toBeNull()
    expect(data).toHaveLength(2500)
    expect(data.at(-1)).toBe(2499)
    expect(page.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
  })

  it('total múltiplo do tamanho da página: faz mais um pedido que volta vazio', async () => {
    const page = fakeTable(2000)
    const { data } = await fetchAllPages(page, 1000)
    expect(data).toHaveLength(2000)
    expect(page).toHaveBeenCalledTimes(3)
  })

  it('tabela vazia', async () => {
    expect((await fetchAllPages(fakeTable(0), 1000)).data).toEqual([])
  })

  it('pára e devolve o erro se uma página falhar', async () => {
    const page = vi
      .fn()
      .mockResolvedValueOnce({ data: [1, 2], error: null })
      .mockResolvedValueOnce({ data: null, error: { code: '42501' } })
    const result = await fetchAllPages(page, 2)
    expect(result.error).toEqual({ code: '42501' })
    expect(page).toHaveBeenCalledTimes(2)
  })
})
