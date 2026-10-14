import { describe, expect, it } from 'vitest'
import {
  addMonths,
  currentMonth,
  formatDay,
  formatMonth,
  isIsoDate,
  isMonthKey,
  monthOf,
  monthRange,
  todayIso,
} from './dates'

describe('todayIso', () => {
  it('usa a data local, mesmo perto da meia-noite', () => {
    // 23:30 de 31 de dezembro (hora local): em UTC podia já ser 1 de janeiro, mas o dia local é 31
    expect(todayIso(new Date(2026, 11, 31, 23, 30))).toBe('2026-12-31')
    expect(todayIso(new Date(2026, 0, 1, 0, 5))).toBe('2026-01-01')
  })

  it('currentMonth devolve YYYY-MM', () => {
    expect(currentMonth(new Date(2026, 9, 14))).toBe('2026-10')
  })
})

describe('meses', () => {
  it('monthOf extrai o mês de uma data', () => {
    expect(monthOf('2026-10-14')).toBe('2026-10')
  })

  it('addMonths atravessa anos nos dois sentidos', () => {
    expect(addMonths('2026-10', 1)).toBe('2026-11')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-03', -15)).toBe('2024-12')
    expect(addMonths('2026-06', 0)).toBe('2026-06')
  })

  it('monthRange devolve [dia 1, dia 1 do mês seguinte)', () => {
    expect(monthRange('2026-10')).toEqual({ from: '2026-10-01', to: '2026-11-01' })
    expect(monthRange('2026-12')).toEqual({ from: '2026-12-01', to: '2027-01-01' })
    // Fevereiro sem ter de saber se o ano é bissexto
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-03-01' })
  })

  it('isMonthKey valida o formato', () => {
    expect(isMonthKey('2026-10')).toBe(true)
    expect(isMonthKey('2026-13')).toBe(false)
    expect(isMonthKey('2026-1')).toBe(false)
    expect(isMonthKey(null)).toBe(false)
  })
})

describe('isIsoDate', () => {
  it('aceita datas reais e recusa impossíveis', () => {
    expect(isIsoDate('2026-10-14')).toBe(true)
    expect(isIsoDate('2028-02-29')).toBe(true) // bissexto
    expect(isIsoDate('2026-02-29')).toBe(false)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('2026-13-01')).toBe(false)
    expect(isIsoDate('14/10/2026')).toBe(false)
    expect(isIsoDate('')).toBe(false)
  })
})

describe('formatação', () => {
  it('formatMonth escreve o mês por extenso', () => {
    expect(formatMonth('2026-10')).toBe('outubro de 2026')
  })

  it('formatDay mostra o dia da semana e omite o ano de referência', () => {
    expect(formatDay('2026-10-14', 2026)).toBe('quarta-feira, 14 de outubro')
    expect(formatDay('2025-12-31', 2026)).toBe('quarta-feira, 31 de dezembro de 2025')
  })
})
