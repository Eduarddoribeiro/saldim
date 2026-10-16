import { describe, expect, it } from 'vitest'
import { dayInMonth, dayOf, nextOccurrence, nextOnOrAfter, occurrencesUntil } from './recurrence'

describe('nextOccurrence', () => {
  it('mensal: o mesmo dia no mês seguinte, também na passagem de ano', () => {
    expect(nextOccurrence('2026-10-10', 'mensal', 10)).toBe('2026-11-10')
    expect(nextOccurrence('2026-12-05', 'mensal', 5)).toBe('2027-01-05')
  })

  it('anual: o mesmo dia e mês no ano seguinte', () => {
    expect(nextOccurrence('2026-03-15', 'anual', 15)).toBe('2027-03-15')
  })

  it('dia 31: usa o último dia dos meses curtos sem perder o dia pedido', () => {
    expect(nextOccurrence('2027-01-31', 'mensal', 31)).toBe('2027-02-28')
    expect(nextOccurrence('2027-02-28', 'mensal', 31)).toBe('2027-03-31')
    expect(nextOccurrence('2027-03-31', 'mensal', 31)).toBe('2027-04-30')
    expect(nextOccurrence('2027-12-31', 'mensal', 30)).toBe('2028-01-30')
  })

  it('29 de fevereiro: ano bissexto e ano normal', () => {
    expect(nextOccurrence('2028-01-29', 'mensal', 29)).toBe('2028-02-29')
    expect(nextOccurrence('2028-02-29', 'anual', 29)).toBe('2029-02-28')
    expect(nextOccurrence('2031-02-28', 'anual', 29)).toBe('2032-02-29')
  })
})

describe('nextOnOrAfter', () => {
  it('devolve a própria data se não for anterior a hoje', () => {
    expect(nextOnOrAfter('2026-10-16', 'mensal', 16, '2026-10-16')).toBe('2026-10-16')
    expect(nextOnOrAfter('2026-11-10', 'mensal', 10, '2026-10-16')).toBe('2026-11-10')
  })

  it('salta as datas que já passaram (retomar uma recorrência parada)', () => {
    expect(nextOnOrAfter('2026-06-10', 'mensal', 10, '2026-10-16')).toBe('2026-11-10')
    expect(nextOnOrAfter('2026-06-20', 'mensal', 20, '2026-10-16')).toBe('2026-10-20')
    expect(nextOnOrAfter('2025-03-01', 'anual', 1, '2026-10-16')).toBe('2027-03-01')
  })
})

describe('occurrencesUntil', () => {
  it('lista as datas da série até ao limite, incluídos', () => {
    expect(occurrencesUntil('2026-08-31', 'mensal', 31, '2026-11-30')).toEqual([
      '2026-08-31',
      '2026-09-30',
      '2026-10-31',
      '2026-11-30',
    ])
  })

  it('vazio se a primeira data já passa do limite', () => {
    expect(occurrencesUntil('2026-11-10', 'mensal', 10, '2026-10-16')).toEqual([])
  })
})

describe('dayInMonth e dayOf', () => {
  it('corta o dia ao fim do mês', () => {
    expect(dayInMonth('2026-02', 31)).toBe('2026-02-28')
    expect(dayInMonth('2026-04', 15)).toBe('2026-04-15')
    expect(dayOf('2026-04-09')).toBe(9)
  })
})
