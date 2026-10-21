import type { CardPurchase } from '@/features/card-purchases/purchases-api'
import type { IsoDate, MonthKey } from '@/lib/dates'
import type { Movement } from '@/lib/finance'

// Detalhe do que uma pessoa deve, por compra e por cartão (T1). Funções puras, sem pedidos à base de
// dados (por isso não estão em people-api.ts). Os valores são BRUTOS: os pagamentos que a pessoa fez
// e a dívida anterior não pertencem a nenhum cartão, por isso só entram no total da pessoa (receivables).

/** Parcela ou estorno com o que é preciso para o detalhe. */
export type DetailMovement = Pick<Movement, 'tipo' | 'valor_centavos'> & {
  compra_id: string | null
  fatura_id: string | null
}

export type PurchaseDebt = {
  purchase: CardPurchase
  /** À vista (1 parcela) ou parcelada */
  parcelada: boolean
  /** Parcelas em faturas que já venceram, mais as pagas antes de usar a app (compra em curso) */
  parcelasVencidas: number
  /** Parcelas em faturas que ainda não venceram */
  parcelasFuturas: number
  /** Σ parcelas − Σ estornos em faturas vencidas */
  vencido: number
  /** Σ parcelas − Σ estornos em faturas futuras */
  futuro: number
}

const amount = (movement: DetailMovement) =>
  movement.tipo === 'estorno' ? -movement.valor_centavos : movement.valor_centavos

/**
 * Uma linha por compra: quanto já venceu e quanto falta, em valor e em parcelas. As parcelas antes da
 * `parcela_inicial` (compra já em curso) contam como vencidas: são anteriores a usar a app.
 */
export function purchaseDebts(
  purchases: CardPurchase[],
  movements: DetailMovement[],
  dueInvoiceIds: ReadonlySet<string>,
): PurchaseDebt[] {
  const byPurchase = new Map<string, DetailMovement[]>()
  for (const movement of movements) {
    if (!movement.compra_id) continue
    const list = byPurchase.get(movement.compra_id)
    if (list) list.push(movement)
    else byPurchase.set(movement.compra_id, [movement])
  }
  return purchases.map((purchase) => {
    let vencido = 0
    let futuro = 0
    let parcelasVencidas = purchase.parcela_inicial - 1
    let parcelasFuturas = 0
    for (const movement of byPurchase.get(purchase.id) ?? []) {
      const due = movement.fatura_id !== null && dueInvoiceIds.has(movement.fatura_id)
      if (due) vencido += amount(movement)
      else futuro += amount(movement)
      if (movement.tipo !== 'despesa') continue
      if (due) parcelasVencidas += 1
      else parcelasFuturas += 1
    }
    return {
      purchase,
      parcelada: purchase.parcelas > 1,
      parcelasVencidas,
      parcelasFuturas,
      vencido,
      futuro,
    }
  })
}

export type CardDebt = { cardId: string; vencido: number; futuro: number }

/** Totais por cartão (pela ordem em que os cartões aparecem) e o total de todos. */
export function debtsByCard(debts: PurchaseDebt[]): { cards: CardDebt[]; total: CardDebt } {
  const cards = new Map<string, CardDebt>()
  const total: CardDebt = { cardId: '', vencido: 0, futuro: 0 }
  for (const debt of debts) {
    const cardId = debt.purchase.account_id
    let card = cards.get(cardId)
    if (!card) cards.set(cardId, (card = { cardId, vencido: 0, futuro: 0 }))
    card.vencido += debt.vencido
    card.futuro += debt.futuro
    total.vencido += debt.vencido
    total.futuro += debt.futuro
  }
  return { cards: [...cards.values()], total }
}

/** Parcela ou estorno com o cartão e a data (para as próximas faturas). */
export type UpcomingSource = DetailMovement & { account_id: string; data: IsoDate }

export type UpcomingItem = {
  compraId: string | null
  cardId: string
  /** Número da parcela (k de n), ou null num estorno */
  parcela: number | null
  /** Positivo numa parcela, negativo num estorno */
  valor: number
}

export type UpcomingMonth = {
  month: MonthKey
  /** O vencimento mais tardio das faturas deste mês ("para ficar em dia até") */
  ultimoVencimento: IsoDate
  /** Σ parcelas − Σ estornos do mês, já com os pagamentos a mais abatidos */
  total: number
  items: UpcomingItem[]
}

/**
 * O que uma pessoa deve em cada mês que vem (docs/features/proximas-faturas.md): parcelas e estornos
 * em faturas que ainda não venceram, agrupados pelo MÊS DO VENCIMENTO da fatura (todos os cartões
 * juntos). `futuro` é o "em faturas futuras" de `receivables` (total − vencido): o que a soma dos meses
 * passa da `futuro` são pagamentos a mais, que abatem primeiro os meses mais próximos (regra 4).
 * Meses que ficam a 0 não aparecem.
 */
export function upcomingByMonth(
  movements: UpcomingSource[],
  purchases: Pick<CardPurchase, 'id' | 'parcela_inicial'>[],
  invoices: { id: string; data_vencimento: IsoDate }[],
  today: IsoDate,
  futuro: number,
): UpcomingMonth[] {
  const vencimentos = new Map(invoices.map((invoice) => [invoice.id, invoice.data_vencimento]))
  // Número de cada parcela: a ordem das datas da compra, a contar da parcela inicial
  const parcelaNumero = new Map<UpcomingSource, number>()
  const inicial = new Map(purchases.map((purchase) => [purchase.id, purchase.parcela_inicial]))
  const byPurchase = new Map<string, UpcomingSource[]>()
  for (const movement of movements) {
    if (movement.tipo !== 'despesa' || !movement.compra_id) continue
    const list = byPurchase.get(movement.compra_id) ?? []
    list.push(movement)
    byPurchase.set(movement.compra_id, list)
  }
  for (const [compraId, list] of byPurchase) {
    list
      .sort((a, b) => a.data.localeCompare(b.data))
      .forEach((movement, index) =>
        parcelaNumero.set(movement, (inicial.get(compraId) ?? 1) + index),
      )
  }

  const months = new Map<MonthKey, UpcomingMonth>()
  for (const movement of movements) {
    const vencimento = movement.fatura_id ? vencimentos.get(movement.fatura_id) : undefined
    if (!vencimento || vencimento <= today) continue
    const month = vencimento.slice(0, 7)
    let row = months.get(month)
    if (!row)
      months.set(month, (row = { month, ultimoVencimento: vencimento, total: 0, items: [] }))
    if (vencimento > row.ultimoVencimento) row.ultimoVencimento = vencimento
    row.total += amount(movement)
    row.items.push({
      compraId: movement.compra_id,
      cardId: movement.account_id,
      parcela: parcelaNumero.get(movement) ?? null,
      valor: amount(movement),
    })
  }

  const sorted = [...months.values()].sort((a, b) => a.month.localeCompare(b.month))
  let credito = sorted.reduce((sum, row) => sum + row.total, 0) - Math.max(futuro, 0)
  for (const row of sorted) {
    const abate = Math.min(Math.max(credito, 0), Math.max(row.total, 0))
    row.total -= abate
    credito -= abate
  }
  return sorted.filter((row) => row.total !== 0)
}

/** Os primeiros `count` meses um a um e os restantes somados numa linha ("fevereiro a setembro"). */
export function groupUpcoming(months: UpcomingMonth[], count = 3) {
  const rest = months.slice(count)
  return {
    shown: months.slice(0, count),
    rest:
      rest.length === 0
        ? null
        : {
            from: rest[0].month,
            to: rest[rest.length - 1].month,
            total: rest.reduce((sum, row) => sum + row.total, 0),
            months: rest,
          },
  }
}

export type DebtFilters = {
  /** '' = todos os cartões */
  cardId: string
  tipo: 'todas' | 'avista' | 'parceladas'
  situacao: 'todas' | 'abertas' | 'terminadas'
}

export const NO_FILTERS: DebtFilters = { cardId: '', tipo: 'todas', situacao: 'todas' }

/** Aplica os filtros; "abertas" = ainda têm parcelas em faturas futuras. */
export function filterDebts(debts: PurchaseDebt[], filters: DebtFilters): PurchaseDebt[] {
  return debts.filter(
    (debt) =>
      (!filters.cardId || debt.purchase.account_id === filters.cardId) &&
      (filters.tipo === 'todas' || (filters.tipo === 'parceladas') === debt.parcelada) &&
      (filters.situacao === 'todas' ||
        (filters.situacao === 'abertas') === debt.parcelasFuturas > 0),
  )
}
