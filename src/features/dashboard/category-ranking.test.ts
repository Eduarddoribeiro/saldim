import { describe, expect, it } from 'vitest'
import { OTHER_CATEGORIES_ID, topCategories } from './category-ranking'

const item = (categoryId: string, total: number, percent: number) => ({
  categoryId,
  total,
  percent,
})

describe('topCategories', () => {
  it('não mexe em listas curtas (incluindo limite + 1: juntar uma só não ajuda)', () => {
    const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => item(id, 10, 17))
    expect(topCategories(six, 5)).toEqual(six)
  })

  it('junta o resto em "Outras", com soma dos valores e percentagens a fechar 100', () => {
    const spending = [
      item('a', 400, 40),
      item('b', 200, 20),
      item('c', 150, 15),
      item('d', 100, 10),
      item('e', 60, 6),
      item('f', 50, 5),
      item('g', 40, 4),
    ]
    const result = topCategories(spending, 5)
    expect(result).toHaveLength(6)
    expect(result.at(-1)).toEqual({
      categoryId: OTHER_CATEGORIES_ID,
      total: 90,
      percent: 9,
      memberIds: ['f', 'g'],
    })
    expect(result.reduce((sum, r) => sum + r.percent, 0)).toBe(100)
  })
})
