import { describe, expect, it } from 'vitest'
import {
  accountBalance,
  availableCredit,
  balanceSeries,
  balancesByAccount,
  budgetStatus,
  categoryComparison,
  compareAmounts,
  isInMonth,
  monthlySeries,
  monthSummary,
  netPosition,
  receivables,
  reimbursementMovements,
  signedAmount,
  spendingByCategory,
  totalBalance,
  transferMovements,
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

describe('posição do Início: disponível, dívida nos cartões e líquido (D4a)', () => {
  const today = '2026-10-14'
  const contas = [
    { id: 'banco', saldo_inicial_centavos: 100000, tipo: 'corrente' },
    { id: 'velha', saldo_inicial_centavos: 5000, tipo: 'poupanca' }, // arquivada: conta igual
    { id: 'visa', saldo_inicial_centavos: 0, tipo: 'cartao_credito' },
    { id: 'master', saldo_inicial_centavos: 0, tipo: 'cartao_credito' },
  ]
  // Compra de 300,00 em 3× no Visa: uma parcela já passou, duas são futuras; 50,00 pagos
  const movimentos = [
    tx({ account_id: 'visa', valor_centavos: 10000, data: '2026-10-01' }),
    tx({ account_id: 'visa', valor_centavos: 10000, data: '2026-11-01' }),
    tx({ account_id: 'visa', valor_centavos: 10000, data: '2026-12-01' }),
    tx({ account_id: 'banco', valor_centavos: 2000, data: '2026-10-02' }),
    ...transferMovements([
      { conta_origem_id: 'banco', conta_destino_id: 'visa', valor_centavos: 5000, data: today },
    ]),
  ]

  it('o disponível é só dinheiro; a dívida é o que falta pagar das parcelas até hoje', () => {
    expect(netPosition(contas, movimentos, { today })).toEqual({
      disponivel: 100000 + 5000 - 2000 - 5000,
      dividaCartoes: 10000 - 5000,
      aReceber: 0,
      liquido: 98000 - 5000,
    })
  })

  it('o líquido é sempre igual ao saldo total (atual e previsto)', () => {
    for (const includeFuture of [false, true]) {
      const options = { today, includeFuture }
      const { disponivel, dividaCartoes, liquido } = netPosition(contas, movimentos, options)
      expect(liquido).toBe(totalBalance(contas, movimentos, options))
      expect(liquido).toBe(disponivel - dividaCartoes)
    }
  })

  it('no previsto, a dívida inclui as parcelas futuras', () => {
    expect(netPosition(contas, movimentos, { today, includeFuture: true }).dividaCartoes).toBe(
      30000 - 5000,
    )
  })

  it('pagar mais do que a dívida dá dívida negativa (crédito a favor)', () => {
    const credito = [
      ...movimentos,
      ...transferMovements([
        { conta_origem_id: 'banco', conta_destino_id: 'master', valor_centavos: 700, data: today },
      ]),
    ]
    expect(netPosition(contas, credito, { today }).dividaCartoes).toBe(5000 - 700)
  })

  it('sem cartões: dívida 0 e o líquido é o disponível', () => {
    const semCartoes = contas.filter((conta) => conta.tipo !== 'cartao_credito')
    const posicao = netPosition(semCartoes, movimentos, { today })
    expect(posicao.dividaCartoes).toBe(0)
    expect(posicao.liquido).toBe(posicao.disponivel)
  })

  it('limite disponível = limite − tudo por pagar, incluindo parcelas futuras', () => {
    const saldoPrevisto = balancesByAccount(contas, movimentos, { today, includeFuture: true }).get(
      'visa',
    )!
    expect(availableCredit(500000, saldoPrevisto)).toBe(500000 - 25000)
    expect(availableCredit(20000, saldoPrevisto)).toBe(-5000) // ultrapassado (não bloqueia)
    expect(availableCredit(20000, 700)).toBe(20700) // crédito a favor soma ao limite
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

describe('transferências e pagamentos de fatura (sem dupla contagem)', () => {
  // Compra no cartão de 300,00 em 3× (parcelas de 100,00 a 10/10, 10/11 e 10/12) e o pagamento de
  // 100,00 da primeira fatura, do banco para o cartão, a 05/11.
  const contas = [
    { id: 'banco', saldo_inicial_centavos: 500000 },
    { id: 'visa', saldo_inicial_centavos: 0 },
  ]
  const parcelas = ['2026-10-10', '2026-11-10', '2026-12-10'].map((data) =>
    tx({ account_id: 'visa', valor_centavos: 10000, data }),
  )
  const pagamento = {
    conta_origem_id: 'banco',
    conta_destino_id: 'visa',
    valor_centavos: 10000,
    data: '2026-11-05',
  }
  const hoje = { today: '2026-11-20' }

  it('cada transferência dá dois movimentos: sai da origem e entra no destino', () => {
    expect(transferMovements([pagamento])).toEqual([
      { account_id: 'banco', tipo: 'despesa', valor_centavos: 10000, data: '2026-11-05' },
      { account_id: 'visa', tipo: 'receita', valor_centavos: 10000, data: '2026-11-05' },
    ])
    expect(transferMovements([])).toEqual([])
  })

  it('o banco desce X, o cartão sobe X e o total não muda', () => {
    const sem = balancesByAccount(contas, parcelas, hoje)
    const com = balancesByAccount(contas, [...parcelas, ...transferMovements([pagamento])], hoje)
    expect(com.get('banco')).toBe(sem.get('banco')! - 10000)
    expect(com.get('visa')).toBe(sem.get('visa')! + 10000)
    expect(totalBalance(contas, [...parcelas, ...transferMovements([pagamento])], hoje)).toBe(
      totalBalance(contas, parcelas, hoje),
    )
    // Dívida do cartão até hoje: 2 parcelas (200,00) − pagamento (100,00)
    expect(com.get('visa')).toBe(-10000)
  })

  it('o pagamento não é despesa: resumo do mês, séries e gastos por categoria não mudam', () => {
    // As funções do mês recebem só as transações: as transferências nunca lhes chegam.
    // Se alguém as juntasse por engano, as despesas de novembro passariam de 100,00 a 200,00:
    expect(monthSummary(parcelas, '2026-11')).toEqual({
      receitas: 0,
      despesas: 10000,
      resultado: -10000,
    })
    expect(monthSummary(transferMovements([pagamento]), '2026-11')).toEqual({
      receitas: 10000,
      despesas: 10000,
      resultado: 0,
    })
    expect(spendingByCategory(parcelas, '2026-11')).toEqual([
      { categoryId: 'alim', total: 10000, percent: 100 },
    ])
    // A soma das parcelas é exatamente o valor da compra
    expect(parcelas.reduce((soma, p) => soma + p.valor_centavos, 0)).toBe(30000)
  })

  it('evolução do saldo: o total continua igual com ou sem o pagamento, mês a mês', () => {
    const meses = ['2026-10', '2026-11', '2026-12']
    const com = balanceSeries(
      contas,
      [...parcelas, ...transferMovements([pagamento])],
      meses,
      hoje.today,
    )
    expect(com).toEqual(balanceSeries(contas, parcelas, meses, hoje.today))
  })

  it('pagamento com data futura só conta no saldo previsto', () => {
    const futuro = { ...pagamento, data: '2026-12-05' }
    const movimentos = [...parcelas, ...transferMovements([futuro])]
    expect(balancesByAccount(contas, movimentos, hoje).get('banco')).toBe(500000)
    expect(
      balancesByAccount(contas, movimentos, { ...hoje, includeFuture: true }).get('banco'),
    ).toBe(490000)
  })
})

describe('estornos (C8, D11): somam no saldo e abatem às despesas no mês do estorno', () => {
  const hoje = { today: '2026-10-16' }
  const cartao = { id: 'visa', saldo_inicial_centavos: 0 }
  // Compra de 300,00 em setembro (Moradia); estorno de 100,00 em outubro
  const movimentos = [
    tx({ account_id: 'visa', category_id: 'casa', valor_centavos: 30000, data: '2026-09-20' }),
    tx({ account_id: 'visa', category_id: 'alim', valor_centavos: 5000, data: '2026-10-02' }),
    tx({ account_id: 'visa', category_id: 'casa', valor_centavos: 2000, data: '2026-10-03' }),
    tx({
      tipo: 'estorno',
      account_id: 'visa',
      category_id: 'casa',
      valor_centavos: 10000,
      data: '2026-10-10',
    }),
  ]

  it('o estorno soma no saldo do cartão (é um crédito)', () => {
    expect(signedAmount(movimentos[3])).toBe(10000)
    expect(accountBalance(cartao, movimentos, hoje)).toBe(-30000 - 5000 - 2000 + 10000)
  })

  it('o estorno não é receita: abate às despesas do mês do estorno; setembro não muda', () => {
    expect(monthSummary(movimentos, '2026-10')).toEqual({
      receitas: 0,
      despesas: 5000 + 2000 - 10000,
      resultado: -5000 - 2000 + 10000,
    })
    expect(monthSummary(movimentos, '2026-09').despesas).toBe(30000)
  })

  it('a série mensal usa as mesmas regras que monthSummary', () => {
    const [setembro, outubro] = monthlySeries(movimentos, ['2026-09', '2026-10'])
    expect(setembro).toEqual({ month: '2026-09', ...monthSummary(movimentos, '2026-09') })
    expect(outubro).toEqual({ month: '2026-10', ...monthSummary(movimentos, '2026-10') })
  })

  it('por categoria: o estorno desconta; uma categoria com mais estornos do que gastos não aparece', () => {
    // Moradia em outubro: 20,00 − 100,00 < 0 → fora; Alimentação fica com 100 %
    expect(spendingByCategory(movimentos, '2026-10')).toEqual([
      { categoryId: 'alim', total: 5000, percent: 100 },
    ])
    // Estorno parcial: 200,00 − 100,00 = 100,00
    const parcial = [
      ...movimentos,
      tx({ category_id: 'casa', valor_centavos: 18000, data: '2026-10-04' }),
    ]
    expect(spendingByCategory(parcial, '2026-10')).toEqual([
      { categoryId: 'casa', total: 10000, percent: 67 },
      { categoryId: 'alim', total: 5000, percent: 33 },
    ])
  })

  it('o orçamento usa o gasto líquido (por isso um estorno devolve margem ao orçamento)', () => {
    const parcial = [
      ...movimentos,
      tx({ category_id: 'casa', valor_centavos: 18000, data: '2026-10-04' }),
    ]
    const gasto = spendingByCategory(parcial, '2026-10').find((row) => row.categoryId === 'casa')!
    expect(budgetStatus(15000, gasto.total)).toMatchObject({ gasto: 10000, restante: 5000 })
  })
})

describe('compras de outras pessoas (T1, D19–D22)', () => {
  const today = '2026-10-14'
  const contas = [
    { id: 'banco', saldo_inicial_centavos: 100000, tipo: 'corrente' },
    { id: 'visa', saldo_inicial_centavos: 0, tipo: 'cartao_credito' },
  ]
  // A mãe comprou 300,00 em 3× (fatura de outubro já venceu; novembro e dezembro não) e devolveu 50,00.
  // Também há uma compra minha de 80,00 e um estorno de 30,00 numa compra da mãe.
  const mae = (overrides: Partial<Tx>) =>
    tx({ account_id: 'visa', category_id: 'casa', pessoa_id: 'mae', ...overrides })
  const movimentos: (Tx & { fatura_id?: string | null })[] = [
    { ...mae({ valor_centavos: 10000, data: '2026-10-01' }), fatura_id: 'out' },
    { ...mae({ valor_centavos: 10000, data: '2026-11-01' }), fatura_id: 'nov' },
    { ...mae({ valor_centavos: 10000, data: '2026-12-01' }), fatura_id: 'dez' },
    { ...mae({ tipo: 'estorno', valor_centavos: 3000, data: '2026-10-05' }), fatura_id: 'nov' },
    { ...tx({ account_id: 'visa', valor_centavos: 8000, data: '2026-10-03' }), fatura_id: 'out' },
  ]
  const reembolsos = [
    { pessoa_id: 'mae', account_id: 'banco', valor_centavos: 5000, data: '2026-10-10' },
  ]
  const vencidas = new Set(['out'])

  it('não contam nas receitas, despesas, categorias nem séries de quem usa a app', () => {
    expect(monthSummary(movimentos, '2026-10')).toEqual({
      receitas: 0,
      despesas: 8000,
      resultado: -8000,
    })
    expect(spendingByCategory(movimentos, '2026-10')).toEqual([
      { categoryId: 'alim', total: 8000, percent: 100 },
    ])
    expect(monthlySeries(movimentos, ['2026-11'])).toEqual([
      { month: '2026-11', receitas: 0, despesas: 0, resultado: 0 },
    ])
  })

  it('contam na dívida do cartão; o reembolso entra no banco sem ser receita', () => {
    const saldos = [...movimentos, ...reimbursementMovements(reembolsos)]
    const balances = balancesByAccount(contas, saldos, { today })
    // Até hoje: parcela de 100,00 da mãe + 80,00 meus − estorno de 30,00
    expect(balances.get('visa')).toBe(-(10000 + 8000 - 3000))
    expect(balances.get('banco')).toBe(100000 + 5000)
    expect(monthSummary(saldos, '2026-10').receitas).toBe(0)
  })

  it('a receber: tudo o que comprou − estornos − o que devolveu; vencido = faturas vencidas − devolvido', () => {
    expect(receivables(movimentos, reembolsos, vencidas)).toEqual([
      { pessoaId: 'mae', total: 30000 - 3000 - 5000, vencido: 10000 - 5000 },
    ])
  })

  it('o vencido fica entre 0 e o total; quem pagou a mais fica com total negativo', () => {
    const pagouTudo = [{ pessoa_id: 'mae', valor_centavos: 30000 }]
    expect(receivables(movimentos, pagouTudo, vencidas)).toEqual([
      { pessoaId: 'mae', total: -3000, vencido: 0 },
    ])
    expect(receivables(movimentos, [], new Set(['out', 'nov', 'dez']))).toEqual([
      { pessoaId: 'mae', total: 27000, vencido: 27000 },
    ])
  })

  it('separa as pessoas e ordena pelo maior total', () => {
    const primo = {
      ...tx({ account_id: 'visa', pessoa_id: 'primo', valor_centavos: 50000 }),
      fatura_id: 'nov',
    }
    expect(
      receivables([...movimentos, primo], reembolsos, vencidas).map((r) => r.pessoaId),
    ).toEqual(['primo', 'mae'])
  })

  it('dívida anterior (D23): soma ao total, conta como vencida e é abatida primeiro', () => {
    const anterior = [{ id: 'mae', divida_anterior_centavos: 40000 }]
    // 220,00 + 400,00 = 620,00; vencido = 100,00 + 400,00 − 50,00
    expect(receivables(movimentos, reembolsos, vencidas, anterior)).toEqual([
      { pessoaId: 'mae', total: 62000, vencido: 45000 },
    ])
    // Só com dívida anterior (sem compras ainda) também aparece; 0 não conta
    expect(receivables([], [], new Set(), [{ id: 'tia', divida_anterior_centavos: 1000 }])).toEqual(
      [{ pessoaId: 'tia', total: 1000, vencido: 1000 }],
    )
    expect(receivables([], [], new Set(), [{ id: 'tio', divida_anterior_centavos: 0 }])).toEqual([])
  })

  it('o líquido soma o que as pessoas devem (D20)', () => {
    const saldos = [...movimentos, ...reimbursementMovements(reembolsos)]
    const aReceber = 22000
    const position = netPosition(contas, saldos, { today }, aReceber)
    expect(position.aReceber).toBe(aReceber)
    expect(position.liquido).toBe(position.disponivel - position.dividaCartoes + aReceber)
    expect(position.liquido).toBe(totalBalance(contas, saldos, { today }) + aReceber)
  })
})
