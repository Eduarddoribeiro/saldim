import { describe, expect, it } from 'vitest'
import { isToPay, summarizeInvoices } from './invoice-summary'

const fatura = (id: string, fechamento: string, vencimento: string) => ({
  id,
  data_fechamento: fechamento,
  data_vencimento: vencimento,
})
const parcela = (fatura_id: string, valor_centavos: number) => ({
  fatura_id,
  valor_centavos,
  tipo: 'despesa',
})
const estorno = (fatura_id: string, valor_centavos: number) => ({
  fatura_id,
  valor_centavos,
  tipo: 'estorno',
})
const pagamento = (fatura_id: string, valor_centavos: number) => ({ fatura_id, valor_centavos })

describe('summarizeInvoices', () => {
  const faturas = [
    fatura('out', '2026-09-25', '2026-10-05'),
    fatura('nov', '2026-10-25', '2026-11-05'),
    fatura('dez', '2026-11-25', '2026-12-05'),
  ]

  it('soma parcelas e pagamentos de cada fatura e calcula o estado no dia indicado', () => {
    const resumo = summarizeInvoices(
      faturas,
      [parcela('out', 10000), parcela('out', 5000), parcela('nov', 10000), parcela('dez', 10000)],
      [pagamento('out', 15000), pagamento('nov', 4000)],
      '2026-11-10',
    )
    expect(
      resumo.map((f) => [f.id, f.totalCentavos, f.pagoCentavos, f.emAbertoCentavos, f.estado]),
    ).toEqual([
      ['out', 15000, 15000, 0, 'paga'],
      ['nov', 10000, 4000, 6000, 'vencida'],
      ['dez', 10000, 0, 10000, 'aberta'],
    ])
    expect(resumo[0].parcelas).toHaveLength(2)
    expect(resumo[0].pagamentos).toHaveLength(1)
  })

  it('fatura fechada (entre o fechamento e o vencimento), com crédito e sem compras', () => {
    const resumo = summarizeInvoices(
      faturas,
      [parcela('out', 10000), parcela('nov', 10000)],
      [pagamento('out', 12000)],
      '2026-10-30',
    )
    expect(resumo.map((f) => f.estado)).toEqual(['com_credito', 'fechada', 'aberta'])
    expect(resumo[0].emAbertoCentavos).toBe(-2000)
    // dez: aberta mesmo sem compras (ainda pode receber compras)
    expect(summarizeInvoices([faturas[0]], [], [], '2026-10-30').map((f) => f.estado)).toEqual([
      'sem_compras',
    ])
  })

  it('estornos (C8) descontam do total; só estornos dá crédito a favor', () => {
    const resumo = summarizeInvoices(
      faturas,
      [parcela('out', 10000), estorno('out', 4000), estorno('nov', 3000)],
      [pagamento('out', 6000)],
      '2026-11-10',
    )
    expect(resumo.map((f) => [f.id, f.totalCentavos, f.emAbertoCentavos, f.estado])).toEqual([
      ['out', 6000, 0, 'paga'],
      ['nov', -3000, -3000, 'com_credito'],
      ['dez', 0, 0, 'aberta'],
    ])
    // Compra estornada por inteiro numa fatura fechada: nada a pagar → paga (não "sem compras")
    const zerada = summarizeInvoices(
      [faturas[0]],
      [parcela('out', 5000), estorno('out', 5000)],
      [],
      '2026-11-10',
    )
    expect(zerada.map((f) => [f.totalCentavos, f.estado])).toEqual([[0, 'paga']])
    expect(isToPay(zerada[0])).toBe(false)
  })

  it('ignora linhas sem fatura e faturas sem nada', () => {
    const resumo = summarizeInvoices(
      [faturas[1]],
      [{ fatura_id: null, valor_centavos: 999, tipo: 'despesa' }],
      [],
      '2026-10-01',
    )
    expect(resumo[0]).toMatchObject({ totalCentavos: 0, pagoCentavos: 0, parcelas: [] })
  })
})

describe('isToPay', () => {
  it('por pagar = aberta/fechada/vencida com valor em aberto', () => {
    expect(isToPay({ estado: 'vencida', emAbertoCentavos: 1 })).toBe(true)
    expect(isToPay({ estado: 'fechada', emAbertoCentavos: 100 })).toBe(true)
    expect(isToPay({ estado: 'aberta', emAbertoCentavos: 100 })).toBe(true)
    expect(isToPay({ estado: 'aberta', emAbertoCentavos: 0 })).toBe(false)
    expect(isToPay({ estado: 'paga', emAbertoCentavos: 0 })).toBe(false)
    expect(isToPay({ estado: 'com_credito', emAbertoCentavos: -5 })).toBe(false)
    expect(isToPay({ estado: 'sem_compras', emAbertoCentavos: 0 })).toBe(false)
  })
})
