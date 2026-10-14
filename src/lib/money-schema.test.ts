import { describe, expect, it } from 'vitest'
import { moneyField } from './money-schema'

const message = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0].message

describe('moneyField', () => {
  it('converte o texto em centavos', () => {
    expect(moneyField().parse('1.234,56')).toBe(123456)
    expect(moneyField().parse('0')).toBe(0)
  })

  it('exige valor', () => {
    expect(message(moneyField().safeParse('  '))).toBe('Indica o valor.')
  })

  it('explica o formato quando o valor é inválido', () => {
    expect(message(moneyField().safeParse('12,345'))).toMatch(/Valor inválido\..*1\.234,56/)
  })

  it('recusa negativos por omissão, com mensagem própria', () => {
    expect(message(moneyField().safeParse('-5'))).toMatch(/Não pode ser negativo/)
  })

  it('aceita negativos quando permitido', () => {
    expect(moneyField({ allowNegative: true }).parse('-50,00')).toBe(-5000)
  })

  it('com positive exige valor maior que zero', () => {
    expect(message(moneyField({ positive: true }).safeParse('0,00'))).toBe(
      'O valor tem de ser maior que zero.',
    )
    expect(moneyField({ positive: true }).parse('0,01')).toBe(1)
  })
})
