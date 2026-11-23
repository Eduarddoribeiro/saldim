import { splitInstallments } from '@/lib/credit-card'
import { addMonthsClamped, daysBetween, type IsoDate } from '@/lib/dates'
import type { ImportLine } from './parse'

// Que linhas do ficheiro já estão no Saldim (docs/features/importar.md, regras 2 e 3). Cada
// lançamento do Saldim só serve para uma linha.

/** Compra num cartão, como está no Saldim */
export type ExistingPurchase = {
  id: string
  data_compra: IsoDate
  valor_total_centavos: number
  parcelas: number
  centavos_na_primeira: boolean
}

/** Lançamento numa conta de dinheiro, como está no Saldim */
export type ExistingTransaction = {
  tipo: string
  valor_centavos: number
  data: IsoDate
}

const near = (a: IsoDate, b: IsoDate, days: number) => Math.abs(daysBetween(a, b)) <= days
const PURCHASE_DAYS = 2
const TRANSACTION_DAYS = 1
const CENTS_TOLERANCE = 2

/** Linhas de um cartão já registadas (ids das linhas). Compra dividida = duas compras somadas. */
export function matchCardLines(
  lines: readonly ImportLine[],
  purchases: readonly ExistingPurchase[],
): Set<string> {
  const used = new Set<string>()
  const found = new Set<string>()
  for (const line of lines) {
    if (line.sentido !== 'saida') continue
    const numero = line.parcela?.numero ?? 1
    const total = line.parcela?.total ?? 1
    // Candidatas: mesmo número de parcelas, data da compra (ou dessa parcela) perto da linha
    const candidates = purchases.filter(
      (purchase) =>
        !used.has(purchase.id) &&
        purchase.parcelas === total &&
        (near(purchase.data_compra, line.data, PURCHASE_DAYS) ||
          near(addMonthsClamped(purchase.data_compra, numero - 1), line.data, PURCHASE_DAYS)),
    )
    const value = (purchase: ExistingPurchase) =>
      splitInstallments(purchase.valor_total_centavos, total, purchase.centavos_na_primeira)[
        numero - 1
      ]
    const close = (cents: number) => Math.abs(cents - line.valorCentavos) <= CENTS_TOLERANCE
    const single = candidates.find((purchase) => close(value(purchase)))
    if (single) {
      used.add(single.id)
      found.add(line.id)
      continue
    }
    // A minha metade + a da Mãe
    pairs: for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        if (close(value(candidates[i]) + value(candidates[j]))) {
          used.add(candidates[i].id)
          used.add(candidates[j].id)
          found.add(line.id)
          break pairs
        }
      }
    }
  }
  return found
}

/** Linhas de uma conta já registadas: mesmo tipo, mesmo valor, data a ±1 dia. */
export function matchAccountLines(
  lines: readonly ImportLine[],
  transactions: readonly ExistingTransaction[],
): Set<string> {
  const used = new Set<number>()
  const found = new Set<string>()
  for (const line of lines) {
    const tipo = line.sentido === 'saida' ? 'despesa' : 'receita'
    const index = transactions.findIndex(
      (tx, i) =>
        !used.has(i) &&
        tx.tipo === tipo &&
        tx.valor_centavos === line.valorCentavos &&
        near(tx.data, line.data, TRANSACTION_DAYS),
    )
    if (index >= 0) {
      used.add(index)
      found.add(line.id)
    }
  }
  return found
}
