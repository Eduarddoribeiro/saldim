import { describe, expect, it } from 'vitest'
import { aliasKey, descriptionKey, suggestFor } from './suggest'

const categories = [
  { id: 'alim', nome: 'Alimentação', tipo: 'despesa', arquivada: false },
  { id: 'transp', nome: 'Transporte', tipo: 'despesa', arquivada: false },
  { id: 'compras', nome: 'Compras', tipo: 'despesa', arquivada: false },
  { id: 'outras', nome: 'Outras despesas', tipo: 'despesa', arquivada: false },
  { id: 'lazer', nome: 'Lazer', tipo: 'despesa', arquivada: false },
  { id: 'salario', nome: 'Salário', tipo: 'receita', arquivada: false },
  { id: 'outras-r', nome: 'Outras receitas', tipo: 'receita', arquivada: false },
]

describe('suggestFor', () => {
  it('aprende com o histórico: a categoria e a pessoa da última vez', () => {
    const history = [
      {
        descricao: 'MERC ACOUGUE AUTODROMO',
        category_id: 'compras',
        pessoa_id: null,
        tipo: 'despesa',
      },
      {
        descricao: 'Merc Acougue Autodromo 18h',
        category_id: 'alim',
        pessoa_id: 'mae',
        tipo: 'despesa',
      },
    ]
    expect(suggestFor('Merc Acougue Autodromo', 'despesa', history, categories)).toEqual({
      categoryId: 'alim',
      pessoaId: 'mae',
    })
  })

  it('sem histórico: por palavras; sem palavras conhecidas: "Outras"', () => {
    expect(suggestFor('UBER *TRIP', 'despesa', [], categories).categoryId).toBe('transp')
    expect(suggestFor('Shopee *vidaoutlet', 'despesa', [], categories).categoryId).toBe('compras')
    expect(suggestFor('Mercadolivre', 'despesa', [], categories).categoryId).toBe('compras')
    expect(suggestFor('Celiamarisa', 'despesa', [], categories).categoryId).toBe('outras')
    expect(suggestFor('Salario Novembro', 'receita', [], categories).categoryId).toBe('salario')
    expect(suggestFor('Pix recebido', 'receita', [], categories).categoryId).toBe('outras-r')
  })

  it('chave da descrição: sem números nem prefixos de maquininha', () => {
    expect(descriptionKey('Pg *ola Doutor')).toBe('ola doutor')
    expect(descriptionKey('Jim.com* 46005')).toBe('jim com')
  })
})

describe('aliasKey', () => {
  it('a descrição do banco sem acentos, números nem pontuação', () => {
    expect(aliasKey('Merc Açougue Autodromo *123')).toBe('merc acougue autodromo')
    expect(aliasKey('MERCADOLIVRE')).toBe('mercadolivre')
  })
})
