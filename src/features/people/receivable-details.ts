import type { CardPurchase } from '@/features/card-purchases/purchases-api'
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
