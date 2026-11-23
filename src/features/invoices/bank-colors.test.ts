import { describe, expect, it } from 'vitest'
import { bankOf, cardClasses } from './bank-colors'

describe('bankOf', () => {
  it('reconhece o banco pelo nome do cartão, sem acentos nem maiúsculas', () => {
    expect(bankOf('Cartão Itaú')).toBe('itau')
    expect(bankOf('Nubank')).toBe('nubank')
    expect(bankOf('nu bank roxinho')).toBe('nubank')
    expect(bankOf('Picpay')).toBe('picpay')
    expect(bankOf('Cartão Caixa')).toBe('caixa')
    expect(bankOf('Banco do Brasil Ourocard')).toBe('bb')
    expect(bankOf('Mercado Pago')).toBe('mercadopago')
    expect(bankOf('Inter Gold')).toBe('inter')
    expect(bankOf('C6 Carbon')).toBe('c6')
  })

  it('não confunde palavras parecidas; sem banco conhecido fica a cor da app', () => {
    expect(bankOf('Internacional')).toBeNull()
    expect(bankOf('Visa')).toBeNull()
    expect(bankOf('Cartão da loja')).toBeNull()
    expect(cardClasses('Visa')).toContain('from-hero')
    expect(cardClasses('Cartão Itaú')).toContain('from-bank-itau')
  })
})
