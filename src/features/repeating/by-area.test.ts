import { describe, expect, it } from 'vitest'
import { byArea } from './by-area'
import type { RepeatingExpense } from './repeating'

const item = (nome: string, categoryId: string, mensal: number): RepeatingExpense => ({
  key: nome,
  nome,
  categoryId,
  mensal,
  vezesPorMes: 1,
  fixo: true,
  meses: 6,
  registada: false,
  esteMes: 0,
  ultimaData: null,
})

describe('byArea', () => {
  it('soma por categoria, com a parte do total e os gastos de cada uma', () => {
    const rows = byArea([
      item('Netflix', 'lazer', 4490),
      item('Aluguel', 'moradia', 180000),
      item('Spotify', 'lazer', 2190),
      item('Internet', 'contas', 11990),
    ])
    expect(rows.map((r) => [r.categoryId, r.mensal, r.nomes])).toEqual([
      ['moradia', 180000, ['Aluguel']],
      ['contas', 11990, ['Internet']],
      ['lazer', 6680, ['Netflix', 'Spotify']],
    ])
    expect(rows.reduce((sum, r) => sum + r.share, 0)).toBeCloseTo(1)
    expect(rows[0].share).toBeCloseTo(180000 / 198670)
  })

  it('sem gastos: lista vazia', () => {
    expect(byArea([])).toEqual([])
  })
})
