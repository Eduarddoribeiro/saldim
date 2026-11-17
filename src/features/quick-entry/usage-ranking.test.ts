import { describe, expect, it } from 'vitest'
import { rankByUsage, usageCounts } from './usage-ranking'

const today = '2026-11-17'
const mov = (category: string | null, data: string) => ({ category_id: category, data })

describe('usageCounts', () => {
  it('conta só os últimos 90 dias até hoje (inclusive nas pontas)', () => {
    const counts = usageCounts(
      [
        mov('mercado', '2026-11-17'), // hoje
        mov('mercado', '2026-08-19'), // há exatamente 90 dias
        mov('mercado', '2026-08-18'), // há 91 dias: fora
        mov('mercado', '2026-11-18'), // amanhã (parcela futura): fora
        mov('lazer', '2026-10-01'),
        mov(null, '2026-11-01'), // sem id: ignorado
      ],
      (movement) => movement.category_id,
      { today },
    )
    expect(Object.fromEntries(counts)).toEqual({ mercado: 2, lazer: 1 })
  })
})

describe('rankByUsage', () => {
  const items = [
    { id: 'a', nome: 'Saúde' },
    { id: 'b', nome: 'Alimentação' },
    { id: 'c', nome: 'Lazer' },
    { id: 'd', nome: 'Educação' },
  ]

  it('mais usados primeiro; empates e os nunca usados por ordem alfabética', () => {
    const ranked = rankByUsage(
      items,
      new Map([
        ['c', 3],
        ['a', 1],
        ['d', 1],
      ]),
    )
    expect(ranked.map((item) => item.nome)).toEqual(['Lazer', 'Educação', 'Saúde', 'Alimentação'])
  })

  it('sem histórico, fica a ordem alfabética (com acentos em pt-BR) e a lista original não muda', () => {
    const ranked = rankByUsage(items, new Map())
    expect(ranked.map((item) => item.nome)).toEqual(['Alimentação', 'Educação', 'Lazer', 'Saúde'])
    expect(items[0].nome).toBe('Saúde')
  })
})
