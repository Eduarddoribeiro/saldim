import { describe, expect, it } from 'vitest'
import { compareAmounts } from '@/lib/finance'
import { comparisonText, previousMonthLabel } from './comparison-text'

const plain = (text: string) => text.replace(/[\u00a0\u202f]/g, ' ')

describe('previousMonthLabel', () => {
  it('sem ano dentro do mesmo ano; com ano na passagem de ano', () => {
    expect(previousMonthLabel('2026-09', '2026-10')).toBe('setembro')
    expect(previousMonthLabel('2025-12', '2026-01')).toBe('dezembro de 2025')
  })
})

describe('comparisonText', () => {
  it('aumento e diminuição com sinal, valor e percentagem', () => {
    expect(plain(comparisonText(compareAmounts(12000, 10000), 'BRL', 'setembro'))).toBe(
      '+R$ 20,00 (+20%) em relação a setembro',
    )
    expect(plain(comparisonText(compareAmounts(7500, 10000), 'BRL', 'setembro'))).toBe(
      '-R$ 25,00 (-25%) em relação a setembro',
    )
  })

  it('sem variação', () => {
    expect(comparisonText(compareAmounts(0, 0), 'BRL', 'setembro')).toBe('igual a setembro')
  })

  it('sem valor anterior: mostra a diferença, sem inventar percentagem', () => {
    expect(plain(comparisonText(compareAmounts(5000, 0), 'EUR', 'setembro'))).toBe(
      '+50,00 € em relação a setembro (sem valor anterior)',
    )
  })
})
