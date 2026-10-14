// Cálculos financeiros do Saldo — implementação EXATA das regras de docs/plano.md → "Cálculos".
// Funções puras: recebem dados, devolvem números. Tudo em centavos inteiros (sem vírgula flutuante).

import { monthRange, type IsoDate, type MonthKey } from './dates'

export type Movement = {
  tipo: 'receita' | 'despesa'
  valor_centavos: number
  data: IsoDate
}
export type AccountMovement = Movement & { account_id: string }
export type CategoryMovement = Movement & { category_id: string }

/** Movimento com sinal: receitas somam, despesas subtraem. */
export function signedAmount(movement: Movement): number {
  return movement.tipo === 'receita' ? movement.valor_centavos : -movement.valor_centavos
}

/** data >= dia 1 do mês e < dia 1 do mês seguinte (comparação de texto 'YYYY-MM-DD' é cronológica). */
export function isInMonth(date: IsoDate, month: MonthKey): boolean {
  const { from, to } = monthRange(month)
  return date >= from && date < to
}

export type MonthSummary = {
  /** Σ receitas do mês */
  receitas: number
  /** Σ despesas do mês (valor positivo) */
  despesas: number
  /** receitas − despesas (pode ser negativo) */
  resultado: number
}

/** Receitas, despesas e resultado de um mês. */
export function monthSummary(movements: Movement[], month: MonthKey): MonthSummary {
  let receitas = 0
  let despesas = 0
  for (const movement of movements) {
    if (!isInMonth(movement.data, month)) continue
    if (movement.tipo === 'receita') receitas += movement.valor_centavos
    else despesas += movement.valor_centavos
  }
  return { receitas, despesas, resultado: receitas - despesas }
}

export type BalanceOptions = {
  /** Data de referência ("hoje", data local). Transações depois dela são futuras. */
  today: IsoDate
  /** true = saldo previsto (inclui transações futuras); false = saldo atual. */
  includeFuture?: boolean
}

/** Saldo da conta: saldo inicial + Σ receitas − Σ despesas da conta (até hoje, ou todas se previsto). */
export function accountBalance(
  account: { id: string; saldo_inicial_centavos: number },
  movements: AccountMovement[],
  { today, includeFuture = false }: BalanceOptions,
): number {
  let balance = account.saldo_inicial_centavos
  for (const movement of movements) {
    if (movement.account_id !== account.id) continue
    if (!includeFuture && movement.data > today) continue
    balance += signedAmount(movement)
  }
  return balance
}

/** Saldo de cada conta, por id (uma só passagem pelas transações). */
export function balancesByAccount(
  accounts: { id: string; saldo_inicial_centavos: number }[],
  movements: AccountMovement[],
  { today, includeFuture = false }: BalanceOptions,
): Map<string, number> {
  const balances = new Map(accounts.map((account) => [account.id, account.saldo_inicial_centavos]))
  for (const movement of movements) {
    if (!includeFuture && movement.data > today) continue
    const current = balances.get(movement.account_id)
    if (current !== undefined) balances.set(movement.account_id, current + signedAmount(movement))
  }
  return balances
}

/**
 * Saldo total: Σ saldos de TODAS as contas (incluindo arquivadas — arquivar esconde a conta das
 * escolhas, não faz desaparecer o dinheiro que lá esteja).
 */
export function totalBalance(
  accounts: { id: string; saldo_inicial_centavos: number }[],
  movements: AccountMovement[],
  options: BalanceOptions,
): number {
  let total = 0
  for (const balance of balancesByAccount(accounts, movements, options).values()) total += balance
  return total
}

export type CategorySpending = {
  categoryId: string
  /** Σ despesas da categoria no mês */
  total: number
  /** Percentagem inteira das despesas do mês (0–100) */
  percent: number
}

/**
 * Gastos por categoria no mês: só despesas, ordenadas do maior para o menor
 * (empate: ordem estável pelo id, para o gráfico não "saltar" entre renderizações).
 */
export function spendingByCategory(
  movements: CategoryMovement[],
  month: MonthKey,
): CategorySpending[] {
  const totals = new Map<string, number>()
  let all = 0
  for (const movement of movements) {
    if (movement.tipo !== 'despesa' || !isInMonth(movement.data, month)) continue
    totals.set(
      movement.category_id,
      (totals.get(movement.category_id) ?? 0) + movement.valor_centavos,
    )
    all += movement.valor_centavos
  }
  return [...totals]
    .map(([categoryId, total]) => ({ categoryId, total, percent: Math.round((total * 100) / all) }))
    .sort((a, b) => b.total - a.total || a.categoryId.localeCompare(b.categoryId))
}

export type BudgetState = 'ok' | 'alerta' | 'excedido'

export type BudgetStatus = {
  limite: number
  /** Σ despesas da categoria no mês */
  gasto: number
  /** limite − gasto (negativo = ultrapassado) */
  restante: number
  /** Math.round(gasto × 100 / limite), inteiro, pode passar de 100 */
  percent: number
  /** ok < 80 % · alerta 80–100 % · excedido > 100 % */
  estado: BudgetState
}

export function budgetStatus(limite: number, gasto: number): BudgetStatus {
  if (!Number.isSafeInteger(limite) || limite <= 0) {
    throw new RangeError(`Limite de orçamento inválido: ${limite} (tem de ser > 0 centavos)`)
  }
  const percent = Math.round((gasto * 100) / limite)
  // O estado compara os valores exatos (não a percentagem arredondada): 100,4 % já é "excedido".
  const estado: BudgetState =
    gasto > limite ? 'excedido' : gasto * 100 >= limite * 80 ? 'alerta' : 'ok'
  return { limite, gasto, restante: limite - gasto, percent, estado }
}
