import { ArrowDownRight, ArrowUpRight, ChevronRight, Scale } from 'lucide-react'
import { Link } from 'react-router'
import { FormAlert } from '@/components/form/FormAlert'
import { MonthPicker } from '@/components/month/MonthPicker'
import { useMonthParam } from '@/components/month/use-month-param'
import { Button } from '@/components/ui/button'
import { isCreditCard, TIPO_CONTA_OPTIONS } from '@/features/accounts/account-options'
import { useAccounts } from '@/features/accounts/hooks'
import { usePurchases } from '@/features/card-purchases/hooks'
import { useCategories } from '@/features/categories/hooks'
import { DueInvoices } from '@/features/invoices/DueInvoices'
import { forBalance } from '@/features/recurring/projection'
import { useRecurringProjection } from '@/features/recurring/use-projection'
import { JourneyChips } from '@/features/journey/JourneyChips'
import { TodayCard } from '@/features/journey/TodayCard'
import { SharedDebtBanner } from '@/features/sharing/SharedDebtBanner'
import { usePeople } from '@/features/people/hooks'
import { useReceivables } from '@/features/people/use-receivables'
import { useProfile } from '@/features/profile/hooks'
import { useQuickEntry } from '@/features/quick-entry/quick-entry-context'
import { useBalanceMovements, useTransactions } from '@/features/transactions/hooks'
import { useTransfers } from '@/features/transfers/hooks'
import { TransactionRow } from '@/features/transactions/TransactionRow'
import {
  addMonths,
  currentMonth,
  formatMonth,
  lastDayOfMonth,
  monthsEndingAt,
  todayIso,
} from '@/lib/dates'
import { errorMessage } from '@/lib/db-errors'
import {
  availableCredit,
  balanceSeries,
  balancesByAccount,
  categoryComparison,
  compareAmounts,
  monthlySeries,
  monthSummary,
  netPosition,
  reimbursementMovements,
  spendingByCategory,
  totalBalance,
  transferMovements,
} from '@/lib/finance'
import { formatMoney, type Currency } from '@/lib/money'
import { CategorySpendingList } from './CategorySpendingList'
import { comparisonText, previousMonthLabel } from './comparison-text'
import { BalanceHero, HeroNumber, HeroStat } from './BalanceHero'
import { BalanceEvolutionPanel, MonthlyComparisonPanel } from './DashboardCharts'
import { MonthStat } from './MonthStat'
import { Panel } from './Panel'
import { QuickActions } from './QuickActions'
import { SummaryTiles } from './SummaryTiles'
import { averageMonthlySpending } from '@/features/savings/reserve'

/** Meses dos gráficos de evolução: o mês escolhido e os 5 anteriores. */
const CHART_MONTHS = 6

export function DashboardPage() {
  const [month, setMonth] = useMonthParam()
  const profile = useProfile()
  const accounts = useAccounts()
  const categories = useCategories()
  const monthTransactions = useTransactions(month)
  const movements = useBalanceMovements()
  // Recorrentes que ainda faltam este mês: só entram no previsto (no dia, a app lança o real)
  // (sem as entradas "só lembrar" atrasadas: podem já ter caído com outro nome)
  const projected = forBalance(useRecurringProjection(lastDayOfMonth(todayIso().slice(0, 7))))
  const transfers = useTransfers()
  const purchases = usePurchases()
  const people = usePeople()
  const receivables = useReceivables()

  const queries = [
    accounts,
    categories,
    monthTransactions,
    movements,
    transfers,
    purchases,
    receivables,
  ]
  const isPending = queries.some((query) => query.isPending)
  const error = queries.find((query) => query.error)?.error
  const currency = profile.data?.moeda === 'EUR' ? 'EUR' : 'BRL'
  const firstName = profile.data?.nome.split(' ')[0]

  const openQuickEntry = useQuickEntry()
  const greeting = firstName ? `Olá, ${firstName}` : 'Olá'
  const header = <BalanceHero greeting={greeting} />

  if (isPending) {
    return (
      <>
        {header}
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          Carregando o resumo…
        </p>
      </>
    )
  }

  if (error) {
    return (
      <>
        {header}
        <div className="mt-4 grid gap-3">
          <FormAlert>{errorMessage(error)}</FormAlert>
          <Button
            variant="outline"
            className="w-fit"
            onClick={() => queries.forEach((query) => void query.refetch())}
          >
            Tentar de novo
          </Button>
        </div>
      </>
    )
  }

  // Cálculos: só funções de src/lib/finance.ts (regras de docs/plano.md)
  const today = todayIso()
  const allAccounts = accounts.data ?? []
  const allMovements = movements.data ?? []
  // Saldos = transações + transferências (pagamentos de fatura). As transferências NÃO entram nos
  // números do mês (receitas, despesas, categorias): não são consumo nem rendimento.
  // Os reembolsos (T1) também: dinheiro que entra numa conta, sem ser receita
  const balanceMovements = [
    ...allMovements,
    ...transferMovements(transfers.data ?? []),
    ...reimbursementMovements(receivables.reimbursements.data ?? []),
    ...projected.map((occurrence) => ({
      account_id: occurrence.account_id,
      category_id: occurrence.category_id,
      tipo: occurrence.tipo,
      valor_centavos: occurrence.valor_centavos,
      data: occurrence.data,
    })),
  ]
  const saldoAtual = totalBalance(allAccounts, balanceMovements, { today })
  const saldoPrevisto = totalBalance(allAccounts, balanceMovements, { today, includeFuture: true })
  const balances = balancesByAccount(allAccounts, balanceMovements, { today })
  // D4a: com cartões, o número principal é o dinheiro disponível (sem a dívida dos cartões)
  const hasCards = allAccounts.some(isCreditCard)
  // D20: o líquido soma o que outras pessoas devem (as compras delas estão na dívida dos cartões).
  // Hoje, só com as parcelas até hoje: o mesmo corte da dívida, senão contava a receber parcelas que
  // ainda nem foram cobradas. No previsto, tudo (a dívida prevista também inclui as parcelas futuras).
  const aReceber = receivables.total
  const position = netPosition(
    allAccounts,
    balanceMovements,
    { today },
    receivables.totalUntilToday,
  )
  const positionPrevista = netPosition(
    allAccounts,
    balanceMovements,
    { today, includeFuture: true },
    aReceber,
  )
  const vencidoTotal = receivables.data.reduce((sum, row) => sum + row.vencido, 0)
  const peopleById = new Map((people.data ?? []).map((person) => [person.id, person.nome]))
  const balancesPrevistos = balancesByAccount(allAccounts, balanceMovements, {
    today,
    includeFuture: true,
  })
  const transactions = monthTransactions.data ?? []
  // Todos os números do mês saem do mesmo conjunto (todos os movimentos), para baterem entre si
  const previousMonth = addMonths(month, -1)
  const previousLabel = previousMonthLabel(previousMonth, month)
  const summary = monthSummary(allMovements, month)
  const previousSummary = monthSummary(allMovements, previousMonth)
  const spending = spendingByCategory(allMovements, month)
  const previousTotals = new Map(
    categoryComparison(allMovements, month).map((row) => [row.categoryId, row.anterior]),
  )
  const chartMonths = monthsEndingAt(month, CHART_MONTHS)
  const series = monthlySeries(allMovements, chartMonths)
  const balancePoints = balanceSeries(allAccounts, balanceMovements, chartMonths, today)
  const vsPrevious = (key: 'receitas' | 'despesas' | 'resultado') =>
    comparisonText(compareAmounts(summary[key], previousSummary[key]), currency, previousLabel)
  const categoriesById = new Map((categories.data ?? []).map((category) => [category.id, category]))
  const accountsById = new Map(allAccounts.map((account) => [account.id, account]))
  // Para mostrar "Parcela k/n" nas últimas transações
  const purchasesById = new Map((purchases.data ?? []).map((purchase) => [purchase.id, purchase]))
  const monthLabel = month === currentMonth() ? 'este mês' : formatMonth(month)
  const transactionsLink = month === currentMonth() ? '/transacoes' : `/transacoes?mes=${month}`

  return (
    <>
      <BalanceHero greeting={greeting}>
        <JourneyChips />
        {hasCards ? (
          <>
            <HeroNumber
              label="Dinheiro disponível"
              value={formatMoney(position.disponivel, currency)}
              hint={
                positionPrevista.disponivel !== position.disponivel
                  ? `Com os lançamentos futuros: ${formatMoney(positionPrevista.disponivel, currency)}`
                  : 'Nas suas contas, sem os cartões, até hoje.'
              }
            />
            {/* Os números que completam o retrato (D4a): líquido, dívida nos cartões e a reserva */}
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/15 pt-3">
              <HeroStat label="Líquido" value={formatMoney(position.liquido, currency)} />
              <HeroStat
                label={position.dividaCartoes < 0 ? 'Crédito cartões' : 'Cartões'}
                value={formatMoney(Math.abs(position.dividaCartoes), currency)}
              />
              <HeroStat label="Guardado" value={formatMoney(position.guardado, currency)} />
            </div>
          </>
        ) : (
          <HeroNumber
            label="Saldo atual"
            value={formatMoney(saldoAtual, currency)}
            hint={
              saldoPrevisto !== saldoAtual
                ? `Com os lançamentos futuros e os recorrentes do mês: ${formatMoney(saldoPrevisto, currency)}`
                : 'Soma de todas as contas, até hoje.'
            }
          />
        )}
      </BalanceHero>

      <QuickActions hasCards={hasCards} />

      <SharedDebtBanner />

      <TodayCard />

      {hasCards && (
        <DueInvoices
          accounts={allAccounts}
          categories={categories.data ?? []}
          purchases={purchases.data ?? []}
        />
      )}

      <SummaryTiles
        guardado={position.guardado}
        metaReserva={averageMonthlySpending(allMovements, today) * 3}
        aReceber={aReceber}
        aReceberSub={
          vencidoTotal > 0
            ? `Já vencido: ${formatMoney(vencidoTotal, currency)}`
            : receivables.data
                .map((row) => peopleById.get(row.pessoaId) ?? 'Outra pessoa')
                .join(', ')
        }
        hasCards={hasCards}
      />

      {/* "Este mês" num só cartão: o mês, o que entrou e saiu lado a lado e o resultado por baixo */}
      <section aria-labelledby="resumo-mes" className="rounded-2xl border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="resumo-mes" className="font-semibold first-letter:uppercase">
            {monthLabel}
          </h2>
          <MonthPicker month={month} onChange={setMonth} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MonthStat
            label="Receitas"
            icon={ArrowUpRight}
            tone="positive"
            value={formatMoney(summary.receitas, currency)}
            hint={vsPrevious('receitas')}
          />
          <MonthStat
            label="Despesas"
            icon={ArrowDownRight}
            value={formatMoney(summary.despesas, currency)}
            hint={vsPrevious('despesas')}
          />
          <MonthStat
            label="Resultado"
            icon={Scale}
            className="col-span-2"
            value={formatMoney(summary.resultado, currency, { signDisplay: 'exceptZero' })}
            hint={
              <>
                {summary.resultado > 0 && <p>Você ganhou mais do que gastou.</p>}
                {summary.resultado < 0 && <p>Você gastou mais do que ganhou.</p>}
                <p>{vsPrevious('resultado')}</p>
              </>
            }
          />
        </div>
      </section>

      {/* No telemóvel (uma coluna), o do dia a dia vem primeiro: últimas transações, gastos e contas;
          os gráficos de 6 meses ficam no fim. No desktop, a grelha de duas colunas fica como estava. */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="grid min-w-0 max-lg:order-last">
          <MonthlyComparisonPanel series={series} currency={currency} />
        </div>
        <div className="grid min-w-0 max-lg:order-last">
          <BalanceEvolutionPanel
            points={balancePoints}
            currency={currency}
            hasAccounts={allAccounts.length > 0}
          />
        </div>

        <Panel title="Gastos por categoria">
          {spending.length === 0 && (
            <p className="mb-2 text-sm text-muted-foreground">
              Nenhuma despesa em {formatMonth(month)}.
            </p>
          )}
          <CategorySpendingList
            spending={spending}
            previousTotals={previousTotals}
            previousLabel={previousLabel}
            categoriesById={categoriesById}
            currency={currency}
          />
        </Panel>

        <Panel
          title="Últimas transações"
          className="max-lg:order-first"
          action={
            <Link
              to={transactionsLink}
              className="inline-flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Ver todas
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          }
        >
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma transação em {formatMonth(month)}.{' '}
              <button
                type="button"
                onClick={() => openQuickEntry()}
                className="font-medium text-foreground underline underline-offset-4"
              >
                Novo lançamento
              </button>
            </p>
          ) : (
            <ul className="-mx-3 divide-y">
              {transactions.slice(0, 5).map((transaction) => (
                <li key={transaction.id}>
                  <TransactionRow
                    transaction={transaction}
                    category={categoriesById.get(transaction.category_id)}
                    account={accountsById.get(transaction.account_id)}
                    totalParcelas={
                      transaction.compra_id
                        ? purchasesById.get(transaction.compra_id)?.parcelas
                        : undefined
                    }
                    purchaseDate={
                      transaction.compra_id
                        ? purchasesById.get(transaction.compra_id)?.data_compra
                        : undefined
                    }
                    personName={
                      transaction.pessoa_id ? peopleById.get(transaction.pessoa_id) : undefined
                    }
                    currency={currency}
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Contas"
          action={
            <Link
              to="/configuracoes/contas"
              className="inline-flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Gerenciar
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          }
        >
          <ul className="divide-y">
            {allAccounts
              .filter((account) => !account.arquivada || balances.get(account.id) !== 0)
              .map((account) => {
                const { icon: Icon, label } = TIPO_CONTA_OPTIONS[account.tipo]
                return (
                  <li key={account.id} className="flex min-h-12 items-center gap-3 py-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{account.nome}</span>
                      <span className="block text-xs text-muted-foreground">
                        {label}
                        {account.arquivada ? ' · arquivada' : ''}
                      </span>
                      {account.limite_centavos !== null && (
                        <CreditLine
                          available={availableCredit(
                            account.limite_centavos,
                            balancesPrevistos.get(account.id) ?? 0,
                          )}
                          currency={currency}
                        />
                      )}
                    </span>
                    <span className="shrink-0 text-sm font-medium tabular-nums">
                      {formatMoney(balances.get(account.id) ?? 0, currency)}
                    </span>
                  </li>
                )
              })}
          </ul>
        </Panel>
      </div>
    </>
  )
}

/** 'Limite disponível: R$ 4.700,00' ou, se as compras passarem do limite, quanto o ultrapassam. */
function CreditLine({ available, currency }: { available: number; currency: Currency }) {
  return (
    <span className="block text-xs text-muted-foreground">
      {available < 0
        ? `Limite ultrapassado em ${formatMoney(-available, currency)}`
        : `Limite disponível: ${formatMoney(available, currency)}`}
    </span>
  )
}
