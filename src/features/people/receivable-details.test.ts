import { describe, expect, it } from 'vitest'
import type { CardPurchase } from '@/features/card-purchases/purchases-api'
import {
  debtsByCard,
  filterDebts,
  NO_FILTERS,
  purchaseDebts,
  type DetailMovement,
} from './receivable-details'

const purchase = (overrides: Partial<CardPurchase>): CardPurchase => ({
  id: 'c',
  user_id: 'u',
  account_id: 'nubank',
  category_id: 'alim',
  descricao: '',
  data_compra: '2026-09-10',
  valor_total_centavos: 10000,
  parcelas: 1,
  parcela_inicial: 1,
  pessoa_id: 'mae',
  created_at: '',
  ...overrides,
})

const parcela = (compra_id: string, valor: number, fatura_id: string): DetailMovement => ({
  tipo: 'despesa',
  valor_centavos: valor,
  compra_id,
  fatura_id,
})

// Faturas vencidas: outubro. Novembro em diante: futuras.
const vencidas = new Set(['nub-out', 'cx-out'])

// Cadeira: 15× de 31,37, em curso desde a 13.ª (12 já pagas antes da app); 13.ª vencida, 14–15 futuras
// Gás: à vista no Caixa, vencido. Mercado: à vista no Nubank, futuro, com um estorno de 5,00.
const compras = [
  purchase({ id: 'cadeira', parcelas: 15, parcela_inicial: 13, valor_total_centavos: 47055 }),
  purchase({ id: 'gas', account_id: 'caixa', valor_total_centavos: 12500 }),
  purchase({ id: 'mercado', valor_total_centavos: 2000 }),
]
const movimentos: DetailMovement[] = [
  parcela('cadeira', 3137, 'nub-out'),
  parcela('cadeira', 3137, 'nub-nov'),
  parcela('cadeira', 3137, 'nub-dez'),
  parcela('gas', 12500, 'cx-out'),
  parcela('mercado', 2000, 'nub-nov'),
  { tipo: 'estorno', valor_centavos: 500, compra_id: 'mercado', fatura_id: 'nub-nov' },
  // De outra pessoa ou sem compra: ignorados
  { tipo: 'despesa', valor_centavos: 999, compra_id: null, fatura_id: 'nub-out' },
]

describe('purchaseDebts', () => {
  it('por compra: parcelas e valores vencidos e futuros (as anteriores à app contam como vencidas)', () => {
    const [cadeira, gas, mercado] = purchaseDebts(compras, movimentos, vencidas)
    expect(cadeira).toMatchObject({
      parcelada: true,
      parcelasVencidas: 13,
      parcelasFuturas: 2,
      vencido: 3137,
      futuro: 6274,
    })
    expect(gas).toMatchObject({
      parcelada: false,
      parcelasVencidas: 1,
      parcelasFuturas: 0,
      vencido: 12500,
      futuro: 0,
    })
    // O estorno desconta mas não é uma parcela
    expect(mercado).toMatchObject({ parcelasFuturas: 1, vencido: 0, futuro: 1500 })
  })
})

describe('debtsByCard', () => {
  it('soma por cartão e no total', () => {
    expect(debtsByCard(purchaseDebts(compras, movimentos, vencidas))).toEqual({
      cards: [
        { cardId: 'nubank', vencido: 3137, futuro: 6274 + 1500 },
        { cardId: 'caixa', vencido: 12500, futuro: 0 },
      ],
      total: { cardId: '', vencido: 3137 + 12500, futuro: 6274 + 1500 },
    })
  })
})

describe('filterDebts', () => {
  const debts = purchaseDebts(compras, movimentos, vencidas)
  const ids = (filters: Partial<typeof NO_FILTERS>) =>
    filterDebts(debts, { ...NO_FILTERS, ...filters }).map((debt) => debt.purchase.id)

  it('por cartão, tipo e situação (combináveis)', () => {
    expect(ids({})).toEqual(['cadeira', 'gas', 'mercado'])
    expect(ids({ cardId: 'caixa' })).toEqual(['gas'])
    expect(ids({ tipo: 'parceladas' })).toEqual(['cadeira'])
    expect(ids({ tipo: 'avista' })).toEqual(['gas', 'mercado'])
    expect(ids({ situacao: 'abertas' })).toEqual(['cadeira', 'mercado'])
    expect(ids({ situacao: 'terminadas' })).toEqual(['gas'])
    expect(ids({ cardId: 'nubank', tipo: 'avista' })).toEqual(['mercado'])
  })
})
