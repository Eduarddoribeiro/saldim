import { describe, expect, it } from 'vitest'
import {
  accountBalance,
  balancesByAccount,
  budgetStatus,
  isInMonth,
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
