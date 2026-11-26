import { describe, expect, it } from 'vitest'
import {
  futureValue,
  incomeTax,
  monthlyDeposit,
  monthsToReach,
  percentOfCdi,
  savingsOptions,
} from './simulate'

describe('simulação de guardar dinheiro', () => {
  it('IR regressivo pelos prazos da Receita', () => {
    expect([180, 181, 360, 361, 720, 721].map(incomeTax)).toEqual([
      0.225, 0.2, 0.2, 0.175, 0.175, 0.15,
    ])
  })

  it('sem juros, o total é o que se depositou', () => {
    expect(futureValue(10000, 12, 0, true)).toBe(120000)
  })

  it('um mês a 12% ao ano rende 0,949%; com IR, 22,5% desse rendimento fica para a Receita', () => {
    expect(futureValue(100000, 1, 0.12, false)).toBe(100949)
    // 949 de rendimento − 22,5% = 735
    expect(futureValue(100000, 1, 0.12, true)).toBe(100735)
  })

  it('90% do CDI rende menos que o CDI', () => {
    expect(percentOfCdi(0.9, 0.1365)).toBeLessThan(0.1365)
    expect(percentOfCdi(1, 0.1365)).toBeCloseTo(0.1365, 6)
  })

  it('R$ 278,38 por mês por 1 ano: CDB e LCI à frente da poupança', () => {
    const options = savingsOptions(27838, 12)
    const byId = Object.fromEntries(options.map((option) => [option.id, option.total]))
    expect(byId.cdb).toBeGreaterThan(byId.poupanca)
    expect(byId.lci).toBeGreaterThan(byId.poupanca)
    expect(byId.cdb).toBeGreaterThan(27838 * 12)
    expect(options.every((option) => option.rendimento === option.total - 27838 * 12)).toBe(true)
    // ordenado do maior para o menor
    expect(options.map((option) => option.total)).toEqual(
      [...options.map((option) => option.total)].sort((a, b) => b - a),
    )
  })

  it('a parte guardada nunca é negativa', () => {
    expect(monthlyDeposit(92793, 0.3)).toBe(27838)
    expect(monthlyDeposit(-5000, 0.3)).toBe(0)
  })

  it('meses até à reserva', () => {
    expect(monthsToReach(435000, 0, 27838)).toBe(15)
    expect(monthsToReach(100, 500, 0)).toBe(0)
    expect(monthsToReach(100000, 0, 0)).toBeNull()
  })
})
