import { isCreditCard } from '@/features/accounts/account-options'
import { useAccounts } from '@/features/accounts/hooks'
import { useInvoiceData } from '@/features/invoices/hooks'
import { summarizeInvoices } from '@/features/invoices/invoice-summary'
import { upcomingCardMonths } from '@/features/invoices/upcoming-months'
import { usePeople } from '@/features/people/hooks'
import { useReceivables } from '@/features/people/use-receivables'
import {
  useProjectedCardCharges,
  useRecurringProjection,
} from '@/features/recurring/use-projection'
import { useRepeatingExpenses } from '@/features/repeating/hooks'
import { averageMonthlySpending } from '@/features/savings/reserve'
import { useBalanceMovements, useImportHistory } from '@/features/transactions/hooks'
import { useTransfers } from '@/features/transfers/hooks'
import { addMonths, lastDayOfMonth, todayIso } from '@/lib/dates'
import { balancesByAccount, reimbursementMovements, transferMovements } from '@/lib/finance'
import {
  dailyVariableSpending,
  forecastUntil,
  receivableEvents,
  type ForecastEvent,
} from './forecast'

/**
 * Os dados do quadro "Como você fica no fim de <mês que vem>": o que está nas contas hoje e cada
 * movimento previsto até ao último dia do mês que vem. `data` é null enquanto carrega.
 */
export function useMonthEndForecast(includeReceber: boolean) {
  const today = todayIso()
  const until = lastDayOfMonth(addMonths(today.slice(0, 7), 1))
  const accounts = useAccounts()
  const movements = useBalanceMovements()
  const history = useImportHistory()
  const transfers = useTransfers()
  const receivables = useReceivables()
  const people = usePeople()
  const repeating = useRepeatingExpenses()
  const { invoices, items, payments } = useInvoiceData()
  const projected = useRecurringProjection(until)
  const projectedCards = useProjectedCardCharges()

  const ready =
    accounts.data &&
    movements.data &&
    history.data &&
    transfers.data &&
    !receivables.isPending &&
    invoices.data &&
    items.data &&
    payments.data &&
    repeating.data
  if (!ready) return null

  const allAccounts = accounts.data!
  const cardIds = new Set(allAccounts.filter(isCreditCard).map((account) => account.id))
  const cardName = (id: string) =>
    allAccounts.find((account) => account.id === id)?.nome ?? 'Cartão'
  const personName = (id: string) =>
    people.data?.find((person) => person.id === id)?.nome ?? 'Outra pessoa'

  // Dinheiro nas contas hoje (sem os cartões), como o "Dinheiro disponível" do Início
  const balances = balancesByAccount(
    allAccounts,
    [
      ...movements.data!,
      ...transferMovements(transfers.data!),
      ...reimbursementMovements(receivables.reimbursements.data ?? []),
    ],
    { today },
  )
  const disponivel = allAccounts
    .filter((account) => !cardIds.has(account.id))
    .reduce((sum, account) => sum + (balances.get(account.id) ?? 0), 0)

  const events: ForecastEvent[] = []
  // Contas: lançamentos com data futura e recorrentes previstos (o que é no cartão vai na fatura)
  for (const movement of [...history.data!.filter((row) => row.data > today), ...projected]) {
    if (cardIds.has(movement.account_id) || movement.data > until) continue
    if (movement.tipo !== 'receita' && movement.tipo !== 'despesa') continue
    const receita = movement.tipo === 'receita'
    events.push({
      data: movement.data,
      kind: receita ? 'entrada' : 'conta',
      descricao: movement.descricao || (receita ? 'Receita' : 'Despesa'),
      valor: receita ? movement.valor_centavos : -movement.valor_centavos,
    })
  }
  // Faturas por pagar que vencem até lá (inteiras: quem paga o banco é você)
  const summaries = summarizeInvoices(invoices.data!, items.data!, payments.data!, today)
  for (const invoice of summaries) {
    if (invoice.emAbertoCentavos <= 0 || invoice.data_vencimento > until) continue
    events.push({
      data: invoice.data_vencimento,
      kind: 'fatura',
      descricao: `Fatura ${cardName(invoice.account_id)}`,
      valor: -invoice.emAbertoCentavos,
    })
  }
  for (const charge of projectedCards) {
    if (charge.vencimento > until) continue
    events.push({
      data: charge.vencimento,
      kind: 'fatura',
      descricao: `${charge.descricao} (previsto, fatura ${cardName(charge.account_id)})`,
      valor: -charge.valor_centavos,
    })
  }
  // O que vão te pagar: o atrasado e a parte de cada pessoa nas faturas até lá
  events.push(
    ...receivableEvents({
      people: receivables.data,
      months: upcomingCardMonths(summaries, today, projectedCards),
      until,
      today,
      name: personName,
    }),
  )

  const daily = dailyVariableSpending(
    averageMonthlySpending(movements.data!, today),
    repeating.data!.totalMensal,
  )
  return forecastUntil({ today, until, disponivel, events, dailySpending: daily, includeReceber })
}
