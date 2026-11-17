import { describe, expect, it } from 'vitest'
import { statementDayLabel, statementTotals } from './statement'

describe('statementTotals', () => {
  it('entrou = receitas + estornos; saiu = despesas; saldo = entrou − saiu', () => {
    expect(
      statementTotals([
        { tipo: 'receita', valor_centavos: 500000 },
        { tipo: 'despesa', valor_centavos: 12345 },
        { tipo: 'despesa', valor_centavos: 1000 },
        { tipo: 'estorno', valor_centavos: 500 },
      ]),
    ).toEqual({ entrou: 500500, saiu: 13345, saldo: 487155 })
  })

  it('lista vazia: tudo a zero', () => {
    expect(statementTotals([])).toEqual({ entrou: 0, saiu: 0, saldo: 0 })
  })
})

describe('statementDayLabel', () => {
  const today = '2026-11-17'
  it('hoje e ontem pelo nome, os outros dias com o dia da semana', () => {
    expect(statementDayLabel('2026-11-17', today)).toBe('Hoje, 17 de novembro')
    expect(statementDayLabel('2026-11-16', today)).toBe('Ontem, 16 de novembro')
    expect(statementDayLabel('2026-11-14', today)).toBe('Sábado, 14 de novembro')
  })

  it('ontem atravessa a mudança de mês e de ano; outro ano mostra o ano', () => {
    expect(statementDayLabel('2026-12-31', '2027-01-01')).toBe('Ontem, 31 de dezembro de 2026')
    expect(statementDayLabel('2025-11-14', today)).toBe('Sexta-feira, 14 de novembro de 2025')
  })
})
