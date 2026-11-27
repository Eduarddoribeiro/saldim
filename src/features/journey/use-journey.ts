import { isSavings } from '@/features/accounts/account-options'
import { useAccounts } from '@/features/accounts/hooks'
import { usePurchases } from '@/features/card-purchases/hooks'
import type { VariableFilter } from '@/features/forecast/forecast'
import { descriptionKey } from '@/features/import/suggest'
import { useInvoiceData } from '@/features/invoices/hooks'
import { useRepeatingExpenses } from '@/features/repeating/hooks'
import { averageMonthlySpending } from '@/features/savings/reserve'
import { useBalanceMovements, useImportHistory } from '@/features/transactions/hooks'
import { useAccountTransfers, useTransfers } from '@/features/transfers/hooks'
import { addMonths, todayIso, type IsoDate } from '@/lib/dates'
import { balancesByAccount, monthSummary, transferMovements } from '@/lib/finance'
import { useClosedDays } from './hooks'
import {
  badgesOf,
  bestStreak,
  challengesDone,
  currentStreak,
  levelOf,
  starsOf,
  weekStart,
  weeklyChallenge,
  type JourneyFacts,
} from './journey'

/**
 * Tudo da jornada (sequência, estrelas, nível, conquistas, desafio da semana), calculado dos dados
 * que já existem. `data` é null enquanto carrega.
 */
export function useJourney() {
  const today = todayIso()
  const closedDays = useClosedDays()
  const accounts = useAccounts()
  const movements = useBalanceMovements()
  const history = useImportHistory()
  const transfers = useTransfers()
  const accountTransfers = useAccountTransfers()
  const purchases = usePurchases()
  const repeating = useRepeatingExpenses()
  const { invoices, payments } = useInvoiceData()

  const ready =
    closedDays.data &&
    accounts.data &&
    movements.data &&
    history.data &&
    transfers.data &&
    accountTransfers.data &&
    purchases.data &&
    repeating.data &&
    invoices.data &&
    payments.data
  if (!ready) return { data: null, isPending: closedDays.isPending, error: closedDays.error }

  const savingsIds = new Set(accounts.data!.filter(isSavings).map((account) => account.id))
  const balances = balancesByAccount(
    accounts.data!,
    [...movements.data!, ...transferMovements(transfers.data!)],
    { today },
  )
  const guardado = [...savingsIds].reduce((sum, id) => sum + (balances.get(id) ?? 0), 0)

  // Faturas pagas por inteiro com todos os pagamentos até ao vencimento
  const paymentsByInvoice = new Map<string, { total: number; last: IsoDate }>()
  for (const payment of payments.data!) {
    if (!payment.fatura_id) continue
    const row = paymentsByInvoice.get(payment.fatura_id) ?? { total: 0, last: payment.data }
    row.total += payment.valor_centavos
    if (payment.data > row.last) row.last = payment.data
    paymentsByInvoice.set(payment.fatura_id, row)
  }
  const invoiceTotals = new Map<string, number>()
  for (const movement of movements.data!) {
    if (!movement.fatura_id) continue
    const signed = movement.tipo === 'estorno' ? -movement.valor_centavos : movement.valor_centavos
    invoiceTotals.set(movement.fatura_id, (invoiceTotals.get(movement.fatura_id) ?? 0) + signed)
  }
  const faturasEmDia = invoices.data!.filter((invoice) => {
    const paid = paymentsByInvoice.get(invoice.id)
    const total = invoiceTotals.get(invoice.id) ?? 0
    return paid && total > 0 && paid.total >= total && paid.last <= invoice.data_vencimento
  }).length

  // Meses acabados em que entrou mais do que saiu (desde o primeiro lançamento)
  const firstMonth = movements.data!.map((movement) => movement.data.slice(0, 7)).sort()[0]
  let mesesAzul = 0
  if (firstMonth) {
    for (let month = firstMonth; month < today.slice(0, 7); month = addMonths(month, 1)) {
      const summary = monthSummary(movements.data!, month)
      if (summary.receitas > 0 && summary.resultado > 0) mesesAzul += 1
    }
  }

  const filter: VariableFilter = {
    history: history.data!,
    installmentIds: new Set(
      purchases.data!.filter((purchase) => purchase.parcelas > 1).map((purchase) => purchase.id),
    ),
    fixedKeys: new Set(repeating.data!.items.filter((item) => item.fixo).map((item) => item.key)),
    key: descriptionKey,
  }

  const facts: JourneyFacts = {
    closedDays: closedDays.data!,
    desafios: challengesDone(filter, closedDays.data!, today),
    depositosReserva: accountTransfers.data!.filter((transfer) =>
      savingsIds.has(transfer.conta_destino_id),
    ).length,
    faturasEmDia,
    mesesAzul,
    guardado,
    gastoMensal: averageMonthlySpending(movements.data!, today),
  }
  const closed = new Set(closedDays.data!)
  const stars = starsOf(facts, today)
  return {
    data: {
      today,
      closed,
      streak: currentStreak(closed, today),
      best: bestStreak(closed, today),
      stars,
      level: levelOf(stars.total),
      badges: badgesOf(facts, today, stars.total),
      challenge: weeklyChallenge(filter, weekStart(today), today),
      facts,
      /** Quantos lançamentos seus têm a data de hoje */
      lancamentosHoje: history.data!.filter((row) => row.data === today && !row.pessoa_id).length,
    },
    isPending: false,
    error: null,
  }
}
