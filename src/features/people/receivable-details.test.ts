import { describe, expect, it } from 'vitest'
import type { CardPurchase } from '@/features/card-purchases/purchases-api'
import {
  debtsByCard,
  filterDebts,
  NO_FILTERS,
  purchaseDebts,
  groupUpcoming,
  upcomingByMonth,
  type DetailMovement,
  type UpcomingSource,
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

describe('próximas faturas por mês (docs/features/proximas-faturas.md)', () => {
  const hoje = '2026-10-21'
  // Faturas: outubro já venceu; Caixa vence a 15, Nubank a 17
  const faturas = [
    { id: 'nub-out', data_vencimento: '2026-10-17' },
    { id: 'cx-nov', data_vencimento: '2026-11-15' },
    { id: 'nub-nov', data_vencimento: '2026-11-17' },
    { id: 'cx-dez', data_vencimento: '2026-12-15' },
    { id: 'cx-jan', data_vencimento: '2027-01-15' },
    { id: 'cx-fev', data_vencimento: '2027-02-15' },
    { id: 'cx-mar', data_vencimento: '2027-03-15' },
  ]
  const mov = (
    compra_id: string,
    account_id: string,
    fatura_id: string,
    data: string,
    valor: number,
    tipo: 'despesa' | 'estorno' = 'despesa',
  ): UpcomingSource => ({ tipo, valor_centavos: valor, compra_id, fatura_id, account_id, data })
  // Cadeira: 15×, em curso desde a 13.ª (13.ª em outubro, já vencida). Remédio: 5× no Caixa.
  const compras = [
    { id: 'cadeira', parcela_inicial: 13 },
    { id: 'remedio', parcela_inicial: 1 },
    { id: 'mercado', parcela_inicial: 1 },
  ]
  const movimentos = [
    mov('cadeira', 'nubank', 'nub-out', '2026-09-10', 3137),
    mov('cadeira', 'nubank', 'nub-nov', '2026-10-10', 3137),
    mov('cadeira', 'nubank', 'cx-dez', '2026-11-10', 3137),
    mov('remedio', 'caixa', 'cx-nov', '2026-10-09', 2000),
    mov('remedio', 'caixa', 'cx-dez', '2026-11-09', 2000),
    mov('remedio', 'caixa', 'cx-jan', '2026-12-09', 2000),
    mov('remedio', 'caixa', 'cx-fev', '2027-01-09', 2000),
    mov('remedio', 'caixa', 'cx-mar', '2027-02-09', 2000),
    mov('mercado', 'nubank', 'nub-nov', '2026-10-20', 10000),
    mov('mercado', 'nubank', 'nub-nov', '2026-10-21', 2500, 'estorno'),
  ]
  // Futuro de receivables = Σ das parcelas e estornos em faturas futuras (sem pagamentos a mais)
  const futuro = 3137 * 2 + 2000 * 5 + 10000 - 2500

  it('agrupa pelo mês do vencimento, junta os cartões e deixa de fora o que já venceu', () => {
    const meses = upcomingByMonth(movimentos, compras, faturas, hoje, futuro)
    expect(meses.map((m) => [m.month, m.total, m.ultimoVencimento])).toEqual([
      // 31,37 (cadeira) + 20,00 (remédio) + 100,00 − 25,00 (mercado e o seu estorno)
      ['2026-11', 3137 + 2000 + 10000 - 2500, '2026-11-17'],
      ['2026-12', 3137 + 2000, '2026-12-15'],
      ['2027-01', 2000, '2027-01-15'],
      ['2027-02', 2000, '2027-02-15'],
      ['2027-03', 2000, '2027-03-15'],
    ])
    // A soma dos meses é o "em faturas futuras"
    expect(meses.reduce((s, m) => s + m.total, 0)).toBe(futuro)
  })

  it('numera as parcelas a partir da parcela inicial (compra em curso) e marca os estornos', () => {
    const [novembro, dezembro] = upcomingByMonth(movimentos, compras, faturas, hoje, futuro)
    expect(novembro.items).toEqual([
      { compraId: 'cadeira', cardId: 'nubank', parcela: 14, valor: 3137 },
      { compraId: 'remedio', cardId: 'caixa', parcela: 1, valor: 2000 },
      { compraId: 'mercado', cardId: 'nubank', parcela: 1, valor: 10000 },
      { compraId: 'mercado', cardId: 'nubank', parcela: null, valor: -2500 },
    ])
    expect(dezembro.items.map((i) => [i.compraId, i.parcela])).toEqual([
      ['cadeira', 15],
      ['remedio', 2],
    ])
  })

  it('pagamentos a mais abatem primeiro os meses mais próximos; meses a 0 não aparecem', () => {
    // A pessoa pagou 150,00 a mais do que o já vencido: novembro (126,37) fica a 0 e dezembro perde 23,63
    const meses = upcomingByMonth(movimentos, compras, faturas, hoje, futuro - 15000)
    expect(meses[0]).toMatchObject({ month: '2026-12', total: 3137 + 2000 - (15000 - 12637) })
    expect(meses.reduce((s, m) => s + m.total, 0)).toBe(futuro - 15000)
  })

  it('sem nada no futuro (ou tudo pago), não há meses', () => {
    expect(upcomingByMonth(movimentos, compras, faturas, hoje, 0)).toEqual([])
    expect(upcomingByMonth([], compras, faturas, hoje, 0)).toEqual([])
  })

  it('mostra 3 meses um a um e soma o resto numa linha', () => {
    const { shown, rest } = groupUpcoming(
      upcomingByMonth(movimentos, compras, faturas, hoje, futuro),
    )
    expect(shown.map((m) => m.month)).toEqual(['2026-11', '2026-12', '2027-01'])
    expect(rest).toMatchObject({ from: '2027-02', to: '2027-03', total: 4000 })
    expect(groupUpcoming(shown).rest).toBeNull()
  })
})
