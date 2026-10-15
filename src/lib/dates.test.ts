import { describe, expect, it } from 'vitest'
import {
  addMonths,
  addMonthsClamped,
  currentMonth,
  daysBetween,
  formatDay,
  formatMonth,
  formatMonthShort,
  isIsoDate,
  isMonthKey,
  lastDayOfMonth,
  monthOf,
  monthRange,
  monthsEndingAt,
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

describe('janelas de meses', () => {
  it('lastDayOfMonth: meses de 30 e 31 dias, fevereiro normal e bissexto', () => {
    expect(lastDayOfMonth('2026-10')).toBe('2026-10-31')
    expect(lastDayOfMonth('2026-09')).toBe('2026-09-30')
    expect(lastDayOfMonth('2026-02')).toBe('2026-02-28')
    expect(lastDayOfMonth('2028-02')).toBe('2028-02-29')
    expect(lastDayOfMonth('2026-12')).toBe('2026-12-31')
  })

  it('monthsEndingAt: do mais antigo ao mês indicado, atravessando o ano', () => {
    expect(monthsEndingAt('2026-02', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    expect(monthsEndingAt('2026-10', 1)).toEqual(['2026-10'])
  })

  it('formatMonthShort: rótulo curto, com ano opcional', () => {
    expect(formatMonthShort('2026-10')).toBe('out')
    expect(formatMonthShort('2027-01', true)).toBe('jan 27')
  })
})

describe('addMonthsClamped', () => {
  it('mantém o dia quando o mês o tem, atravessando anos nos dois sentidos', () => {
    expect(addMonthsClamped('2026-10-14', 1)).toBe('2026-11-14')
    expect(addMonthsClamped('2026-11-15', 2)).toBe('2027-01-15')
    expect(addMonthsClamped('2026-01-15', -1)).toBe('2025-12-15')
    expect(addMonthsClamped('2026-10-14', 0)).toBe('2026-10-14')
  })

  it('dias 29, 30 e 31 passam ao último dia de meses mais curtos', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29') // bissexto
    expect(addMonthsClamped('2026-01-29', 1)).toBe('2026-02-28')
    expect(addMonthsClamped('2028-01-29', 1)).toBe('2028-02-29')
    expect(addMonthsClamped('2026-01-30', 1)).toBe('2026-02-28')
    expect(addMonthsClamped('2026-03-31', 1)).toBe('2026-04-30')
    expect(addMonthsClamped('2026-03-31', -1)).toBe('2026-02-28')
    expect(addMonthsClamped('2100-01-31', 1)).toBe('2100-02-28') // 2100 não é bissexto
  })

  it('a partir da data original recupera o dia depois de um mês curto', () => {
    expect([0, 1, 2, 3].map((delta) => addMonthsClamped('2026-01-31', delta))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ])
  })
})

describe('daysBetween', () => {
  it('conta dias, com sinal', () => {
    expect(daysBetween('2026-10-14', '2026-10-14')).toBe(0)
    expect(daysBetween('2026-10-14', '2026-10-21')).toBe(7)
    expect(daysBetween('2026-10-21', '2026-10-14')).toBe(-7)
  })

  it('fevereiro normal e bissexto, viragem de ano', () => {
    expect(daysBetween('2026-02-01', '2026-03-01')).toBe(28)
    expect(daysBetween('2028-02-01', '2028-03-01')).toBe(29)
    expect(daysBetween('2026-12-25', '2027-01-05')).toBe(11)
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365)
    expect(daysBetween('2028-01-01', '2029-01-01')).toBe(366)
  })

  it('não é afetado pela mudança da hora (março e outubro)', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
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
