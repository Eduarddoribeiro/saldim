import { describe, expect, it } from 'vitest'
import {
  accountBalance,
  balanceSeries,
  balancesByAccount,
  budgetStatus,
  categoryComparison,
  compareAmounts,
  isInMonth,
  monthlySeries,
  monthSummary,
  signedAmount,
  spendingByCategory,
  totalBalance,
  type AccountMovement,
  type CategoryMovement,
} from './finance'

type Tx = AccountMovement & CategoryMovement

const tx = (overrides: Partial<Tx>): Tx => ({
  tipo: 'despesa',
  valor_centavos: 1000,
  data: '2026-10-14',
  account_id: 'banco',
  category_id: 'alim',
  ...overrides,
})

describe('signedAmount e isInMonth', () => {
  it('receitas positivas, despesas negativas', () => {
    expect(signedAmount(tx({ tipo: 'receita', valor_centavos: 500 }))).toBe(500)
    expect(signedAmount(tx({ tipo: 'despesa', valor_centavos: 500 }))).toBe(-500)
  })

  it('inclui o primeiro e o último dia; exclui o dia 1 do mês seguinte', () => {
    expect(isInMonth('2026-10-01', '2026-10')).toBe(true)
    expect(isInMonth('2026-10-31', '2026-10')).toBe(true)
    expect(isInMonth('2026-11-01', '2026-10')).toBe(false)
    expect(isInMonth('2026-09-30', '2026-10')).toBe(false)
    expect(isInMonth('2028-02-29', '2028-02')).toBe(true)
  })
})

describe('monthSummary', () => {
  it('mês sem transações dá tudo a zero', () => {
    expect(monthSummary([], '2026-10')).toEqual({ receitas: 0, despesas: 0, resultado: 0 })
  })

  it('soma receitas e despesas do mês e calcula o resultado', () => {
    const movements = [
      tx({ tipo: 'receita', valor_centavos: 500000 }),
      tx({ tipo: 'despesa', valor_centavos: 123456 }),
      tx({ tipo: 'despesa', valor_centavos: 1 }),
      tx({ tipo: 'receita', valor_centavos: 99, data: '2026-10-31' }),
      // Fora do mês: ignoradas
      tx({ tipo: 'despesa', valor_centavos: 777, data: '2026-09-30' }),
      tx({ tipo: 'receita', valor_centavos: 888, data: '2026-11-01' }),
    ]
    expect(monthSummary(movements, '2026-10')).toEqual({
      receitas: 500099,
      despesas: 123457,
      resultado: 376642,
    })
  })

  it('o resultado pode ser negativo', () => {
    const movements = [tx({ tipo: 'receita', valor_centavos: 100 }), tx({ valor_centavos: 250 })]
    expect(monthSummary(movements, '2026-10').resultado).toBe(-150)
  })

  it('soma exata sem erros de vírgula flutuante (0,10 + 0,20 = 0,30)', () => {
    const movements = [tx({ valor_centavos: 10 }), tx({ valor_centavos: 20 })]
    expect(monthSummary(movements, '2026-10').despesas).toBe(30)
  })
})

describe('saldos', () => {
  const banco = { id: 'banco', saldo_inicial_centavos: 100000 }
  const carteira = { id: 'carteira', saldo_inicial_centavos: -2000 }
  const today = '2026-10-14'
  const movements = [
    tx({ tipo: 'receita', valor_centavos: 50000, data: '2026-10-01' }),
    tx({ tipo: 'despesa', valor_centavos: 30000, data: '2026-10-14' }), // hoje: conta
    tx({ tipo: 'despesa', valor_centavos: 99999, data: '2026-10-15' }), // amanhã: futura
    tx({ tipo: 'despesa', valor_centavos: 500, data: '2026-10-02', account_id: 'carteira' }),
    tx({ tipo: 'receita', valor_centavos: 7, data: '2025-01-01', account_id: 'carteira' }), // antiga
  ]

  it('saldo atual = saldo inicial + receitas − despesas até hoje (inclusive)', () => {
    expect(accountBalance(banco, movements, { today })).toBe(100000 + 50000 - 30000)
  })

  it('saldo previsto inclui transações futuras', () => {
    expect(accountBalance(banco, movements, { today, includeFuture: true })).toBe(
      100000 + 50000 - 30000 - 99999,
    )
  })

  it('só conta as transações da própria conta; saldo pode ser negativo', () => {
    expect(accountBalance(carteira, movements, { today })).toBe(-2000 - 500 + 7)
  })

  it('conta sem transações fica com o saldo inicial', () => {
    expect(accountBalance({ id: 'nova', saldo_inicial_centavos: 4200 }, movements, { today })).toBe(
      4200,
    )
  })

  it('balancesByAccount coincide com accountBalance para cada conta', () => {
    const balances = balancesByAccount([banco, carteira], movements, { today })
    expect(balances.get('banco')).toBe(accountBalance(banco, movements, { today }))
    expect(balances.get('carteira')).toBe(accountBalance(carteira, movements, { today }))
  })

  it('saldo total soma todas as contas e ignora transações de contas desconhecidas', () => {
    const withOrphan = [...movements, tx({ account_id: 'outra', valor_centavos: 123 })]
    expect(totalBalance([banco, carteira], withOrphan, { today })).toBe(120000 + -2493)
    expect(totalBalance([], movements, { today })).toBe(0)
  })
})

describe('spendingByCategory', () => {
  it('agrupa só despesas do mês, do maior para o menor, com percentagem', () => {
    const movements = [
      tx({ category_id: 'casa', valor_centavos: 60000 }),
      tx({ category_id: 'alim', valor_centavos: 25000 }),
      tx({ category_id: 'alim', valor_centavos: 5000 }),
      tx({ category_id: 'lazer', valor_centavos: 10000 }),
      tx({ category_id: 'salario', tipo: 'receita', valor_centavos: 999999 }), // receita: ignorada
      tx({ category_id: 'casa', valor_centavos: 1, data: '2026-09-30' }), // outro mês
    ]
    expect(spendingByCategory(movements, '2026-10')).toEqual([
      { categoryId: 'casa', total: 60000, percent: 60 },
      { categoryId: 'alim', total: 30000, percent: 30 },
      { categoryId: 'lazer', total: 10000, percent: 10 },
    ])
  })

  it('mês sem despesas devolve lista vazia (sem dividir por zero)', () => {
    expect(spendingByCategory([tx({ tipo: 'receita' })], '2026-10')).toEqual([])
  })

  it('empates têm ordem estável e as percentagens são inteiros arredondados', () => {
    const movements = ['c', 'a', 'b'].map((id) => tx({ category_id: id, valor_centavos: 100 }))
    const result = spendingByCategory(movements, '2026-10')
    expect(result.map((r) => r.categoryId)).toEqual(['a', 'b', 'c'])
    expect(result.map((r) => r.percent)).toEqual([33, 33, 33])
  })
})

describe('budgetStatus', () => {
  it('calcula gasto, restante e percentagem', () => {
    expect(budgetStatus(50000, 20000)).toEqual({
      limite: 50000,
      gasto: 20000,
      restante: 30000,
      percent: 40,
      estado: 'ok',
    })
  })

  it.each([
    [7999, 'ok'],
    [8000, 'alerta'], // 80 % exato
    [10000, 'alerta'], // 100 % exato ainda é alerta
    [10001, 'excedido'],
    [0, 'ok'],
  ] as const)('gasto %i de 10000 → %s', (gasto, estado) => {
    expect(budgetStatus(10000, gasto).estado).toBe(estado)
  })

  it('usa os valores exatos para o estado, não a percentagem arredondada', () => {
    // 100,4 % arredonda para 100, mas já passou o limite
    const status = budgetStatus(100000, 100400)
    expect(status.percent).toBe(100)
    expect(status.estado).toBe('excedido')
    expect(status.restante).toBe(-400)
  })

  it('percentagem pode passar de 100', () => {
    expect(budgetStatus(1000, 2500).percent).toBe(250)
  })

  it('recusa limites inválidos', () => {
    expect(() => budgetStatus(0, 10)).toThrow(RangeError)
    expect(() => budgetStatus(-5, 10)).toThrow(RangeError)
    expect(() => budgetStatus(10.5, 10)).toThrow(RangeError)
  })
})

describe('compareAmounts (comparação com o período anterior)', () => {
  it('diferença em centavos e percentagem inteira', () => {
    expect(compareAmounts(12000, 10000)).toEqual({
      atual: 12000,
      anterior: 10000,
      diferenca: 2000,
      percent: 20,
    })
    expect(compareAmounts(7500, 10000)).toMatchObject({ diferenca: -2500, percent: -25 })
    expect(compareAmounts(10000, 10000)).toMatchObject({ diferenca: 0, percent: 0 })
  })

  it('sem base de comparação (anterior = 0) não inventa percentagem', () => {
    expect(compareAmounts(5000, 0)).toMatchObject({ diferenca: 5000, percent: null })
    expect(compareAmounts(0, 0)).toMatchObject({ diferenca: 0, percent: null })
  })

  it('resultado negativo que melhora dá variação positiva (divide pelo valor absoluto)', () => {
    // −100,00 → −50,00: melhorou 50 %
    expect(compareAmounts(-5000, -10000)).toMatchObject({ diferenca: 5000, percent: 50 })
    // +100,00 → −100,00: piorou 200 %
    expect(compareAmounts(-10000, 10000)).toMatchObject({ diferenca: -20000, percent: -200 })
  })

  it('arredonda a percentagem ao inteiro mais próximo', () => {
    expect(compareAmounts(1, 3).percent).toBe(-67) // −66,67 %
    expect(compareAmounts(4, 3).percent).toBe(33) // +33,33 %
  })
})

describe('monthlySeries (receitas × despesas por mês)', () => {
  const meses = ['2026-08', '2026-09', '2026-10']

  it('um ponto por mês pedido, pela ordem pedida; meses vazios com zeros', () => {
    const serie = monthlySeries(
      [
        tx({ tipo: 'receita', valor_centavos: 300000, data: '2026-08-05' }),
        tx({ tipo: 'despesa', valor_centavos: 120050, data: '2026-08-31' }),
        tx({ tipo: 'despesa', valor_centavos: 999, data: '2026-10-01' }),
      ],
      meses,
    )
    expect(serie).toEqual([
      { month: '2026-08', receitas: 300000, despesas: 120050, resultado: 179950 },
      { month: '2026-09', receitas: 0, despesas: 0, resultado: 0 },
      { month: '2026-10', receitas: 0, despesas: 999, resultado: -999 },
    ])
  })

  it('ignora movimentos fora dos meses pedidos (limites de mês)', () => {
    const serie = monthlySeries(
      [
        tx({ data: '2026-07-31', valor_centavos: 1 }),
        tx({ data: '2026-11-01', valor_centavos: 2 }),
        tx({ data: '2026-10-31', valor_centavos: 4 }),
      ],
      meses,
    )
    expect(serie.map((row) => row.despesas)).toEqual([0, 0, 4])
  })

  it('cada mês dá exatamente o mesmo que monthSummary', () => {
    const movimentos = [
      tx({ tipo: 'receita', valor_centavos: 500000, data: '2026-09-01' }),
      tx({ valor_centavos: 12345, data: '2026-09-30' }),
      tx({ valor_centavos: 777, data: '2026-10-15' }),
    ]
    for (const row of monthlySeries(movimentos, meses)) {
      expect(row).toEqual({ month: row.month, ...monthSummary(movimentos, row.month) })
    }
  })

  it('sem movimentos: só zeros', () => {
    expect(monthlySeries([], meses).every((row) => row.receitas + row.despesas === 0)).toBe(true)
  })
})

describe('balanceSeries (evolução do saldo)', () => {
  const contas = [
    { id: 'banco', saldo_inicial_centavos: 100000 },
    { id: 'antiga', saldo_inicial_centavos: 5000 }, // arquivada: conta igual
  ]
  const today = '2026-10-14'

  it('saldo no fim de cada mês: saldos iniciais + movimentos até ao último dia', () => {
    const serie = balanceSeries(
      contas,
      [
        tx({ tipo: 'receita', valor_centavos: 300000, data: '2026-08-31' }),
        tx({ valor_centavos: 50000, data: '2026-09-01' }),
        tx({ account_id: 'antiga', valor_centavos: 5000, data: '2026-09-30' }),
      ],
      ['2026-07', '2026-08', '2026-09'],
      today,
    )
    expect(serie).toEqual([
      { month: '2026-07', ate: '2026-07-31', saldo: 105000, previsto: false },
      { month: '2026-08', ate: '2026-08-31', saldo: 405000, previsto: false },
      { month: '2026-09', ate: '2026-09-30', saldo: 350000, previsto: false },
    ])
  })

  it('no mês atual corta em hoje e bate com o saldo atual (totalBalance)', () => {
    const movimentos = [
      tx({ tipo: 'receita', valor_centavos: 200000, data: '2026-10-01' }),
      tx({ valor_centavos: 30000, data: '2026-10-14' }), // hoje: conta
      tx({ valor_centavos: 99900, data: '2026-10-20' }), // agendada: ainda não conta
    ]
    const [ponto] = balanceSeries(contas, movimentos, ['2026-10'], today)
    expect(ponto).toEqual({ month: '2026-10', ate: today, saldo: 275000, previsto: false })
    expect(ponto.saldo).toBe(totalBalance(contas, movimentos, { today }))
  })

  it('meses futuros são previsão: incluem transações agendadas até ao fim do mês', () => {
    const movimentos = [
      tx({ valor_centavos: 99900, data: '2026-10-20' }),
      tx({ tipo: 'receita', valor_centavos: 1000, data: '2026-11-30' }),
      tx({ tipo: 'receita', valor_centavos: 7, data: '2026-12-01' }),
    ]
    const [novembro] = balanceSeries(contas, movimentos, ['2026-11'], today)
    expect(novembro).toEqual({ month: '2026-11', ate: '2026-11-30', saldo: 6100, previsto: true })
  })

  it('pode ficar negativo; sem contas nem movimentos é zero', () => {
    const [ponto] = balanceSeries(
      [{ id: 'banco', saldo_inicial_centavos: 0 }],
      [tx({ valor_centavos: 2500, data: '2026-09-10' })],
      ['2026-09'],
      today,
    )
    expect(ponto.saldo).toBe(-2500)
    expect(balanceSeries([], [], ['2026-09'], today)[0].saldo).toBe(0)
  })

  it('ignora movimentos de contas que não estão na lista (como balancesByAccount)', () => {
    const [ponto] = balanceSeries(
      [{ id: 'banco', saldo_inicial_centavos: 0 }],
      [tx({ account_id: 'outra', valor_centavos: 2500, data: '2026-09-10' })],
      ['2026-09'],
      today,
    )
    expect(ponto.saldo).toBe(0)
  })

  it('fevereiro de ano bissexto corta no dia 29', () => {
    const [ponto] = balanceSeries(contas, [], ['2028-02'], '2028-03-10')
    expect(ponto.ate).toBe('2028-02-29')
  })
})

describe('categoryComparison (gastos por categoria vs mês anterior)', () => {
  it('compara cada categoria com o mês anterior, incluindo as que só existem num deles', () => {
    const linhas = categoryComparison(
      [
        tx({ category_id: 'alim', valor_centavos: 30000, data: '2026-10-02' }),
        tx({ category_id: 'alim', valor_centavos: 20000, data: '2026-09-30' }),
        tx({ category_id: 'casa', valor_centavos: 100000, data: '2026-10-01' }),
        tx({ category_id: 'lazer', valor_centavos: 8000, data: '2026-09-01' }),
        // Fora dos dois meses e receitas: não contam
        tx({ category_id: 'alim', valor_centavos: 1, data: '2026-08-31' }),
        tx({ category_id: 'sal', tipo: 'receita', valor_centavos: 500000, data: '2026-10-05' }),
      ],
      '2026-10',
    )
    expect(linhas).toEqual([
      { categoryId: 'casa', atual: 100000, anterior: 0, diferenca: 100000, percent: null },
      { categoryId: 'alim', atual: 30000, anterior: 20000, diferenca: 10000, percent: 50 },
      { categoryId: 'lazer', atual: 0, anterior: 8000, diferenca: -8000, percent: -100 },
    ])
  })

  it('janeiro compara com dezembro do ano anterior', () => {
    const linhas = categoryComparison(
      [
        tx({ valor_centavos: 500, data: '2025-12-31' }),
        tx({ valor_centavos: 1000, data: '2026-01-01' }),
      ],
      '2026-01',
    )
    expect(linhas).toEqual([
      { categoryId: 'alim', atual: 1000, anterior: 500, diferenca: 500, percent: 100 },
    ])
  })

  it('sem despesas nos dois meses: lista vazia', () => {
    expect(categoryComparison([], '2026-10')).toEqual([])
  })
})
