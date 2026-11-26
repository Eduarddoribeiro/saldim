import { describe, expect, it } from 'vitest'
import { repeatingExpenses } from './repeating'

type M = Parameters<typeof repeatingExpenses>[0]['movements'][number]
const mov = (descricao: string, data: string, valor: number, extra: Partial<M> = {}): M => ({
  descricao,
  category_id: 'cat',
  tipo: 'despesa',
  valor_centavos: valor,
  data,
  pessoa_id: null,
  compra_id: null,
  recorrencia_id: null,
  ...extra,
})
// Hoje: 23/11/2026 → meses olhados: maio a outubro
const today = '2026-11-23'
const months = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']

describe('repeatingExpenses', () => {
  it('descobre o que volta todos os meses, com o valor por mês e se é fixo', () => {
    const netflix = months.map((m) => mov('Netflix.com', `${m}-12`, 4490))
    const mercado = months.flatMap((m) => [
      mov('Mercado Bom Preço', `${m}-03`, 20000),
      mov('Mercado Bom Preço', `${m}-18`, 10000 + Number(m.slice(5)) * 1000),
    ])
    const { items } = repeatingExpenses({
      movements: [...netflix, ...mercado, mov('Netflix.com', '2026-11-12', 4490)],
      purchases: [],
      recurrences: [],
      today,
    })
    expect(items.map((i) => [i.nome, i.mensal, i.fixo, i.vezesPorMes, i.meses, i.esteMes])).toEqual(
      [
        ['Mercado Bom Preço', 37500, false, 2, 6, 0],
        ['Netflix.com', 4490, true, 1, 6, 4490],
      ],
    )
  })

  it('ignora parcelas, compras de outras pessoas, o que acabou e o que é raro', () => {
    const { items } = repeatingExpenses({
      movements: [
        // Notebook 10×: aparece todos os meses, mas é uma compra parcelada
        ...months.map((m) => mov('Notebook', `${m}-19`, 42000, { compra_id: 'nb' })),
        // Da Mãe
        ...months.map((m) => mov('Farmácia', `${m}-10`, 5000, { pessoa_id: 'mae' })),
        // Academia: só até julho (cancelada)
        ...months.slice(0, 3).map((m) => mov('Academia', `${m}-08`, 10990)),
        // Cinema: 2 vezes em 6 meses
        mov('Cinema', '2026-09-24', 5000),
        mov('Cinema', '2026-10-24', 5000),
      ],
      purchases: [{ id: 'nb', parcelas: 10 }],
      recurrences: [],
      today,
    })
    expect(items).toEqual([])
  })

  it('junta as recorrências de despesa ativas (anual ÷ 12) e calcula a parte do que entra', () => {
    const salario = ['2026-08', '2026-09', '2026-10'].map((m) =>
      mov('Salário', `${m}-05`, 600000, { tipo: 'receita' }),
    )
    const result = repeatingExpenses({
      movements: salario,
      purchases: [],
      recurrences: [
        {
          id: 'r1',
          descricao: 'Aluguel',
          category_id: 'moradia',
          tipo: 'despesa',
          valor_centavos: 180000,
          frequencia: 'mensal',
          ativa: true,
        },
        {
          id: 'r2',
          descricao: 'IPVA',
          category_id: 'transporte',
          tipo: 'despesa',
          valor_centavos: 120000,
          frequencia: 'anual',
          ativa: true,
        },
        {
          id: 'r3',
          descricao: 'Pausada',
          category_id: 'x',
          tipo: 'despesa',
          valor_centavos: 999,
          frequencia: 'mensal',
          ativa: false,
        },
      ],
      today,
    })
    expect(result.items.map((i) => [i.nome, i.mensal, i.registada])).toEqual([
      ['Aluguel', 180000, true],
      ['IPVA', 10000, true],
    ])
    expect([result.totalMensal, result.totalAnual, result.receitaMensal]).toEqual([
      190000, 2280000, 600000,
    ])
    expect(result.percentual).toBeCloseTo(0.3167, 3)
  })

  it('usa a categoria do recorrente cadastrado, mesmo que os lançamentos antigos tenham outra', () => {
    const { items } = repeatingExpenses({
      movements: months.map((m) => mov('Spotify', `${m}-22`, 3190, { category_id: 'lazer' })),
      purchases: [],
      recurrences: [
        {
          id: 'r1',
          descricao: 'Spotify',
          category_id: 'assinaturas',
          tipo: 'despesa',
          valor_centavos: 3190,
          frequencia: 'mensal',
          ativa: true,
        },
      ],
      today,
    })
    expect(items.map((i) => [i.nome, i.categoryId])).toEqual([['Spotify', 'assinaturas']])
  })
})
