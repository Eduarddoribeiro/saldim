import { describe, expect, it } from 'vitest'
import { assertCents, centsToInput, formatMoney, MAX_CENTS, parseMoney } from './money'

// Intl usa espaços não separáveis entre o símbolo e o número; normalizamos para comparar.
const plain = (text: string) => text.replace(/[\u00a0\u202f]/g, ' ')

describe('parseMoney', () => {
  it.each([
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['1234,5', 123450],
    ['0,01', 1],
    ['0,99', 99],
    ['10', 1000],
    ['0', 0],
    ['1.234', 123400], // ponto + 3 dígitos = separador de milhares
    ['1.234.567,89', 123456789],
    ['12.5', 1250], // ponto + 1–2 dígitos = decimal (teclados em inglês)
    ['12.50', 1250],
    ['R$ 1.234,56', 123456],
    ['R$\u00a012,00', 1200],
    ['€ 7,5', 750],
    ['  42,00  ', 4200],
    ['007,10', 710],
  ])('"%s" → %i centavos', (input, expected) => {
    expect(parseMoney(input)).toBe(expected)
  })

  it('evita os erros da vírgula flutuante', () => {
    // parseFloat('1.15') * 100 === 114.99999999999999; aqui o resultado é exato
    expect(parseMoney('1,15')).toBe(115)
    expect(parseMoney('0,29')).toBe(29)
    expect(parseMoney('19,99')).toBe(1999)
    // 0,10 + 0,20 em centavos é exatamente 0,30
    expect(parseMoney('0,10')! + parseMoney('0,20')!).toBe(parseMoney('0,30'))
  })

  it.each([
    [''],
    ['   '],
    ['abc'],
    ['12,345'], // mais de 2 casas decimais
    ['1,2,3'],
    ['1.23.4'],
    ['12,'],
    [',50'],
    ['1.2345'], // ponto com 4 dígitos: ambíguo → recusado
    ['12.34.56'],
    ['1e5'],
    ['Infinity'],
    ['--5'],
    ['5-'],
  ])('recusa "%s"', (input) => {
    expect(parseMoney(input)).toBeNull()
  })

  it('recusa negativos por omissão e aceita-os quando permitido', () => {
    expect(parseMoney('-10,00')).toBeNull()
    expect(parseMoney('-10,00', { allowNegative: true })).toBe(-1000)
    expect(parseMoney('−1.234,56', { allowNegative: true })).toBe(-123456) // sinal de menos tipográfico
    expect(parseMoney('-0', { allowNegative: true })).toBe(0) // nunca -0
  })

  it('aceita o valor máximo e recusa acima dele', () => {
    expect(parseMoney('999.999.999,99')).toBe(MAX_CENTS)
    expect(parseMoney('1.000.000.000,00')).toBeNull()
    expect(parseMoney('99999999999999999999')).toBeNull()
  })
})

describe('formatMoney', () => {
  it('formata reais em pt-BR', () => {
    expect(plain(formatMoney(123456))).toBe('R$ 1.234,56')
    expect(plain(formatMoney(5))).toBe('R$ 0,05')
    expect(plain(formatMoney(0))).toBe('R$ 0,00')
    expect(plain(formatMoney(-1050))).toBe('-R$ 10,50')
  })

  it('formata euros em pt-PT', () => {
    expect(plain(formatMoney(123456, 'EUR'))).toBe('1234,56 €')
    expect(plain(formatMoney(1234567, 'EUR'))).toBe('12 345,67 €')
  })

  it('pode mostrar sempre o sinal', () => {
    expect(plain(formatMoney(1000, 'BRL', { signDisplay: 'always' }))).toBe('+R$ 10,00')
  })

  it('formata o valor máximo sem perder precisão', () => {
    expect(plain(formatMoney(MAX_CENTS))).toBe('R$ 999.999.999,99')
  })

  it('recusa valores que não são centavos inteiros', () => {
    expect(() => formatMoney(12.5)).toThrow(TypeError)
    expect(() => formatMoney(Number.NaN)).toThrow(TypeError)
  })
})

describe('centsToInput', () => {
  it.each([
    [123456, '1234,56'],
    [5, '0,05'],
    [100, '1,00'],
    [0, '0,00'],
    [-1050, '-10,50'],
  ])('%i → "%s"', (cents, expected) => {
    expect(centsToInput(cents)).toBe(expected)
  })

  it('faz ida e volta com parseMoney', () => {
    for (const cents of [1, 99, 100, 123456, MAX_CENTS]) {
      expect(parseMoney(centsToInput(cents))).toBe(cents)
    }
    expect(parseMoney(centsToInput(-777), { allowNegative: true })).toBe(-777)
  })
})

describe('assertCents', () => {
  it('aceita inteiros seguros e recusa o resto', () => {
    expect(() => assertCents(0)).not.toThrow()
    expect(() => assertCents(-5)).not.toThrow()
    expect(() => assertCents(0.1)).toThrow()
    expect(() => assertCents(Number.MAX_SAFE_INTEGER + 1)).toThrow()
  })
})
