import { describe, expect, it } from 'vitest'
import { dueSoon, isToPay, summarizeInvoices, totalsByPerson } from './invoice-summary'

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

describe('dueSoon', () => {
  const f = (
    id: string,
    data_vencimento: string,
    estado: 'aberta' | 'fechada' | 'vencida' | 'paga',
    emAbertoCentavos = 100,
  ) => ({
    id,
    data_vencimento,
    estado,
    emAbertoCentavos,
  })
  const hoje = '2026-11-17'

  it('vencidas e as que vencem até 7 dias (inclusive), a mais urgente primeiro', () => {
    const result = dueSoon(
      [
        f('daqui-a-8', '2026-11-25', 'aberta'),
        f('daqui-a-7', '2026-11-24', 'fechada'),
        f('hoje', '2026-11-17', 'fechada'),
        f('vencida', '2026-11-05', 'vencida'),
      ],
      hoje,
    )
    expect(result.map((invoice) => invoice.id)).toEqual(['vencida', 'hoje', 'daqui-a-7'])
  })

  it('ignora pagas e as que não têm nada em aberto', () => {
    expect(
      dueSoon(
        [f('paga', '2026-11-18', 'paga', 0), f('credito', '2026-11-18', 'fechada', -50)],
        hoje,
      ),
    ).toEqual([])
  })
})

describe('totalsByPerson', () => {
  const item = (pessoa_id: string | null, valor_centavos: number, tipo = 'despesa') => ({
    pessoa_id,
    valor_centavos,
    tipo,
  })

  it('separa o que é de cada pessoa; quem usa a app primeiro; a soma é o total da fatura', () => {
    const items = [
      item(null, 5000),
      item('mae', 7915),
      item('ana', 2000),
      item('mae', 1000),
      item(null, 1000, 'estorno'),
    ]
    const result = totalsByPerson(items)
    expect(result).toEqual([
      { pessoaId: null, centavos: 4000 },
      { pessoaId: 'mae', centavos: 8915 },
      { pessoaId: 'ana', centavos: 2000 },
    ])
    expect(result.reduce((sum, row) => sum + row.centavos, 0)).toBe(14915)
  })

  it('omite quem ficou a zero (compra estornada por inteiro)', () => {
    expect(
      totalsByPerson([item('mae', 3000), item('mae', 3000, 'estorno'), item(null, 100)]),
    ).toEqual([{ pessoaId: null, centavos: 100 }])
  })
})
