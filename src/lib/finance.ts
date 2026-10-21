// Cálculos financeiros do Saldo — implementação EXATA das regras de docs/plano.md → "Cálculos".
// Funções puras: recebem dados, devolvem números. Tudo em centavos inteiros (sem vírgula flutuante).

import {
  addMonths,
  lastDayOfMonth,
  monthOf,
  monthRange,
  type IsoDate,
  type MonthKey,
} from './dates'

export type Movement = {
  /**
   * estorno (C8, D11): crédito de uma compra no cartão. Nos saldos soma (como uma receita); nos
   * relatórios abate às despesas da categoria da compra no mês do estorno (não é rendimento).
   */
  tipo: 'receita' | 'despesa' | 'estorno'
  valor_centavos: number
  data: IsoDate
  /**
   * T1 (D19): parcela ou estorno de uma compra de OUTRA pessoa. Conta nos saldos (é dívida real do
   * cartão) mas não nas receitas, despesas, categorias nem orçamentos: não é consumo de quem usa a app.
   */
  pessoa_id?: string | null
}
export type AccountMovement = Movement & { account_id: string }
export type CategoryMovement = Movement & { category_id: string }

/** Transferência entre contas próprias (o pagamento de uma fatura é uma transferência para o cartão). */
export type Transfer = {
  conta_origem_id: string
  conta_destino_id: string
  valor_centavos: number
  data: IsoDate
}

/**
 * Transferências como movimentos de SALDO: sai da origem e entra no destino, na mesma data.
 * Só para os saldos (balancesByAccount, totalBalance, balanceSeries) — nunca para receitas, despesas,
 * gastos por categoria ou orçamentos: uma transferência não é consumo nem rendimento, e o total das
 * contas não muda (−valor + valor = 0).
 */
export function transferMovements(transfers: Transfer[]): AccountMovement[] {
  return transfers.flatMap((transfer) => [
    {
      account_id: transfer.conta_origem_id,
      tipo: 'despesa' as const,
      valor_centavos: transfer.valor_centavos,
      data: transfer.data,
    },
    {
      account_id: transfer.conta_destino_id,
      tipo: 'receita' as const,
      valor_centavos: transfer.valor_centavos,
      data: transfer.data,
    },
  ])
}

/** Reembolso (T1, D21): dinheiro que uma pessoa devolve; entra numa conta de dinheiro. */
export type Reimbursement = {
  pessoa_id: string
  account_id: string
  valor_centavos: number
  data: IsoDate
}

/**
 * Reembolsos como movimentos de SALDO (entrada na conta), como as transferências: nunca contam nas
 * receitas, despesas ou categorias — devolver dinheiro emprestado não é rendimento.
 */
export function reimbursementMovements(reimbursements: Reimbursement[]): AccountMovement[] {
  return reimbursements.map((reimbursement) => ({
    account_id: reimbursement.account_id,
    tipo: 'receita' as const,
    valor_centavos: reimbursement.valor_centavos,
    data: reimbursement.data,
    // Com a pessoa: mesmo que entre por engano num relatório, isOwn deixa-o de fora
    pessoa_id: reimbursement.pessoa_id,
  }))
}

/** O movimento é de quem usa a app (não de uma compra de outra pessoa): conta nos relatórios. */
function isOwn(movement: Movement): boolean {
  return !movement.pessoa_id
}

/** Movimento com sinal: receitas e estornos somam, despesas subtraem. */
export function signedAmount(movement: Movement): number {
  return movement.tipo === 'despesa' ? -movement.valor_centavos : movement.valor_centavos
}

/**
 * Quanto o movimento conta nas DESPESAS (pode ser negativo): uma despesa conta o valor, um estorno
 * desconta-o (D11), uma receita não conta.
 */
function expenseAmount(movement: Movement): number {
  if (movement.tipo === 'despesa') return movement.valor_centavos
  if (movement.tipo === 'estorno') return -movement.valor_centavos
  return 0
}

/** data >= dia 1 do mês e < dia 1 do mês seguinte (comparação de texto 'YYYY-MM-DD' é cronológica). */
export function isInMonth(date: IsoDate, month: MonthKey): boolean {
  const { from, to } = monthRange(month)
  return date >= from && date < to
}

export type MonthSummary = {
  /** Σ receitas do mês */
  receitas: number
  /** Σ despesas do mês − Σ estornos do mês (normalmente positivo; negativo só se houver mais estornos) */
  despesas: number
  /** receitas − despesas (pode ser negativo) */
  resultado: number
}

/** Receitas, despesas e resultado de um mês. */
export function monthSummary(movements: Movement[], month: MonthKey): MonthSummary {
  let receitas = 0
  let despesas = 0
  for (const movement of movements) {
    if (!isOwn(movement) || !isInMonth(movement.data, month)) continue
    if (movement.tipo === 'receita') receitas += movement.valor_centavos
    else despesas += expenseAmount(movement)
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

export type NetPosition = {
  /** Σ saldos das contas de dinheiro (tudo menos cartões) */
  disponivel: number
  /** O que se deve nos cartões: −Σ saldos dos cartões (negativo = crédito a favor) */
  dividaCartoes: number
  /** O que outras pessoas devem (T1, D20; negativo = é quem usa a app que lhes deve) */
  aReceber: number
  /** disponivel − dividaCartoes + aReceber (sem a receber: = totalBalance) */
  liquido: number
}

/**
 * Posição do Início (D4a): dinheiro disponível, dívida nos cartões e saldo líquido. Todas as contas
 * contam, incluindo as arquivadas (como em totalBalance). Com `includeFuture`, a dívida inclui as
 * parcelas futuras (D1a: cada parcela conta na sua data). D20: a dívida dos cartões inclui as compras
 * de outras pessoas, por isso o líquido soma o que elas devem (`aReceber`, total de `receivables`).
 */
export function netPosition(
  accounts: { id: string; saldo_inicial_centavos: number; tipo: string }[],
  movements: AccountMovement[],
  options: BalanceOptions,
  aReceber = 0,
): NetPosition {
  const balances = balancesByAccount(accounts, movements, options)
  let disponivel = 0
  let cartoes = 0
  for (const account of accounts) {
    const balance = balances.get(account.id) ?? 0
    if (account.tipo === 'cartao_credito') cartoes += balance
    else disponivel += balance
  }
  // `|| 0`: sem cartões, −0 apareceria como "-R$ 0,00"
  return {
    disponivel,
    dividaCartoes: -cartoes || 0,
    aReceber,
    liquido: disponivel + cartoes + aReceber,
  }
}

/** Parcela ou estorno com a pessoa da compra e a fatura (para saber se já venceu). */
export type ThirdPartyItem = {
  pessoa_id?: string | null
  tipo: Movement['tipo']
  valor_centavos: number
  fatura_id?: string | null
}

export type Receivable = {
  pessoaId: string
  /** Dívida anterior + Σ parcelas − Σ estornos − Σ reembolsos (negativo = a pessoa pagou a mais) */
  total: number
  /** A parte do total que já está em faturas vencidas (0 a total) */
  vencido: number
}

/**
 * O que cada pessoa deve (T1, D22): TODAS as parcelas registadas das suas compras (também as de
 * faturas futuras), menos os estornos dessas compras, menos o que já devolveu. `vencido` é a parte
 * em faturas que já venceram (`dueInvoiceIds`) menos o que devolveu, entre 0 e o total. Os reembolsos
 * abatem primeiro ao que já venceu (paga-se o mais antigo primeiro). Ordem: maior total primeiro.
 * D23: a dívida anterior de cada pessoa (`priorDebts`) soma ao total e conta como já vencida.
 */
export function receivables(
  items: ThirdPartyItem[],
  reimbursements: Pick<Reimbursement, 'pessoa_id' | 'valor_centavos'>[],
  dueInvoiceIds: ReadonlySet<string>,
  priorDebts: { id: string; divida_anterior_centavos: number }[] = [],
): Receivable[] {
  const totals = new Map<string, { compras: number; vencidas: number; devolvido: number }>()
  const row = (pessoaId: string) => {
    let current = totals.get(pessoaId)
    if (!current) totals.set(pessoaId, (current = { compras: 0, vencidas: 0, devolvido: 0 }))
    return current
  }
  for (const item of items) {
    if (!item.pessoa_id || item.tipo === 'receita') continue
    const current = row(item.pessoa_id)
    const amount = expenseAmount(item as Movement)
    current.compras += amount
    if (item.fatura_id && dueInvoiceIds.has(item.fatura_id)) current.vencidas += amount
  }
  for (const reimbursement of reimbursements) {
    row(reimbursement.pessoa_id).devolvido += reimbursement.valor_centavos
  }
  for (const { id, divida_anterior_centavos: anterior } of priorDebts) {
    if (anterior === 0) continue
    const current = row(id)
    current.compras += anterior
    current.vencidas += anterior
  }
  return [...totals]
    .map(([pessoaId, { compras, vencidas, devolvido }]) => {
      const total = compras - devolvido
      return {
        pessoaId,
        total,
        vencido: Math.min(Math.max(vencidas - devolvido, 0), Math.max(total, 0)),
      }
    })
    .sort((a, b) => b.total - a.total || a.pessoaId.localeCompare(b.pessoaId))
}

/**
 * Limite disponível de um cartão: limite − tudo o que está por pagar, incluindo parcelas futuras
 * (como nos bancos: uma compra parcelada ocupa logo o valor total do limite). `saldoPrevisto` é o
 * saldo do cartão com includeFuture (negativo = dívida). Pode ser negativo (limite ultrapassado:
 * o limite não bloqueia compras) ou maior que o limite (crédito a favor).
 */
export function availableCredit(limite: number, saldoPrevisto: number): number {
  return limite + saldoPrevisto
}

export type CategorySpending = {
  categoryId: string
  /** Σ despesas − Σ estornos da categoria no mês */
  total: number
  /** Percentagem inteira das despesas do mês (0–100) */
  percent: number
}

/**
 * Gastos por categoria no mês: despesas menos estornos (D11), ordenados do maior para o menor
 * (empate: ordem estável pelo id, para o gráfico não "saltar" entre renderizações). Uma categoria cujos
 * estornos do mês igualam ou passam as despesas não aparece (não há gasto para mostrar); as
 * percentagens são sobre as categorias que aparecem.
 */
export function spendingByCategory(
  movements: CategoryMovement[],
  month: MonthKey,
): CategorySpending[] {
  const totals = new Map<string, number>()
  let all = 0
  for (const movement of movements) {
    if (!isOwn(movement) || movement.tipo === 'receita' || !isInMonth(movement.data, month))
      continue
    totals.set(
      movement.category_id,
      (totals.get(movement.category_id) ?? 0) + expenseAmount(movement),
    )
  }
  for (const [categoryId, total] of totals) {
    if (total <= 0) totals.delete(categoryId)
    else all += total
  }
  return [...totals]
    .map(([categoryId, total]) => ({ categoryId, total, percent: Math.round((total * 100) / all) }))
    .sort((a, b) => b.total - a.total || a.categoryId.localeCompare(b.categoryId))
}

export type Comparison = {
  atual: number
  anterior: number
  /** atual − anterior, em centavos */
  diferenca: number
  /**
   * Variação inteira em % face ao anterior (sobre o valor absoluto, para um resultado negativo que
   * melhora dar uma variação positiva). null quando o anterior é 0: não há base para comparar.
   */
  percent: number | null
}

/** Compara um valor deste período com o do período anterior. */
export function compareAmounts(atual: number, anterior: number): Comparison {
  const diferenca = atual - anterior
  return {
    atual,
    anterior,
    diferenca,
    percent: anterior === 0 ? null : Math.round((diferenca * 100) / Math.abs(anterior)),
  }
}

export type MonthlyTotals = MonthSummary & { month: MonthKey }

/**
 * Receitas, despesas e resultado de cada mês pedido, pela ordem pedida (mesmas regras de
 * monthSummary). Meses sem movimentos aparecem com zeros: um mês vazio é informação, não um buraco.
 */
export function monthlySeries(movements: Movement[], months: MonthKey[]): MonthlyTotals[] {
  const totals = new Map<MonthKey, MonthlyTotals>(
    months.map((month) => [month, { month, receitas: 0, despesas: 0, resultado: 0 }]),
  )
  for (const movement of movements) {
    const row = totals.get(monthOf(movement.data))
    if (!row || !isOwn(movement)) continue
    if (movement.tipo === 'receita') row.receitas += movement.valor_centavos
    else row.despesas += expenseAmount(movement)
    row.resultado += signedAmount(movement)
  }
  return months.map((month) => totals.get(month)!)
}

export type BalancePoint = {
  month: MonthKey
  /** Data de corte do saldo: último dia do mês, ou hoje no mês atual */
  ate: IsoDate
  saldo: number
  /** true = mês que ainda não começou: o saldo inclui transações agendadas (é uma previsão) */
  previsto: boolean
}

/**
 * Saldo total (todas as contas, incluindo arquivadas, como em totalBalance) no fim de cada mês:
 * Σ saldos iniciais + Σ movimentos com data <= data de corte.
 * - mês passado: corte no último dia do mês;
 * - mês atual: corte em hoje, para o último ponto bater com o "Saldo atual";
 * - mês futuro: corte no último dia do mês, marcado como previsto.
 * As contas não têm data de abertura, por isso o saldo inicial conta em todos os meses.
 */
export function balanceSeries(
  accounts: { id: string; saldo_inicial_centavos: number }[],
  movements: AccountMovement[],
  months: MonthKey[],
  today: IsoDate,
): BalancePoint[] {
  const accountIds = new Set(accounts.map((account) => account.id))
  const inicial = accounts.reduce((sum, account) => sum + account.saldo_inicial_centavos, 0)
  return months.map((month) => {
    const end = lastDayOfMonth(month)
    const previsto = monthRange(month).from > today
    const ate = previsto || end <= today ? end : today
    let saldo = inicial
    for (const movement of movements) {
      // Igual a balancesByAccount: movimentos de contas desconhecidas não contam
      if (movement.data <= ate && accountIds.has(movement.account_id)) {
        saldo += signedAmount(movement)
      }
    }
    return { month, ate, saldo, previsto }
  })
}

export type CategoryComparison = Comparison & { categoryId: string }

/**
 * Gasto de cada categoria no mês e no mês anterior (regras de spendingByCategory). Inclui as
 * categorias que só tiveram gastos num dos dois meses. Ordem: maior gasto atual, depois maior gasto
 * anterior, depois id (estável).
 */
export function categoryComparison(
  movements: CategoryMovement[],
  month: MonthKey,
): CategoryComparison[] {
  const totals = (target: MonthKey) =>
    new Map(spendingByCategory(movements, target).map((row) => [row.categoryId, row.total]))
  const atual = totals(month)
  const anterior = totals(addMonths(month, -1))
  return [...new Set([...atual.keys(), ...anterior.keys()])]
    .map((categoryId) => ({
      categoryId,
      ...compareAmounts(atual.get(categoryId) ?? 0, anterior.get(categoryId) ?? 0),
    }))
    .sort(
      (a, b) =>
        b.atual - a.atual || b.anterior - a.anterior || a.categoryId.localeCompare(b.categoryId),
    )
}

export type BudgetState = 'ok' | 'alerta' | 'excedido'

export type BudgetStatus = {
  limite: number
  /** Σ despesas − Σ estornos da categoria no mês */
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
