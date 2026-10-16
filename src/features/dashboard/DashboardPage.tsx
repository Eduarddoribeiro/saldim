import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  CreditCard,
  Landmark,
  Scale,
  Wallet,
} from 'lucide-react'
import { Link } from 'react-router'
import { FormAlert } from '@/components/form/FormAlert'
import { PageHeader } from '@/components/layout/PageHeader'
import { MonthPicker } from '@/components/month/MonthPicker'
import { useMonthParam } from '@/components/month/use-month-param'
import { Button } from '@/components/ui/button'
import { isCreditCard, TIPO_CONTA_OPTIONS } from '@/features/accounts/account-options'
import { useAccounts } from '@/features/accounts/hooks'
import { usePurchases } from '@/features/card-purchases/hooks'
import { useCategories } from '@/features/categories/hooks'
import { useProfile } from '@/features/profile/hooks'
import { useBalanceMovements, useTransactions } from '@/features/transactions/hooks'
import { useTransfers } from '@/features/transfers/hooks'
import { TransactionRow } from '@/features/transactions/TransactionRow'
import { addMonths, currentMonth, formatMonth, monthsEndingAt, todayIso } from '@/lib/dates'
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
  spendingByCategory,
  totalBalance,
  transferMovements,
} from '@/lib/finance'
import { formatMoney, type Currency } from '@/lib/money'
import { CategorySpendingList } from './CategorySpendingList'
import { comparisonText, previousMonthLabel } from './comparison-text'
import { BalanceEvolutionPanel, MonthlyComparisonPanel } from './DashboardCharts'
import { Panel } from './Panel'
import { StatTile } from './StatTile'

/** Meses dos gráficos de evolução: o mês escolhido e os 5 anteriores. */
const CHART_MONTHS = 6

export function DashboardPage() {
  const [month, setMonth] = useMonthParam()
  const profile = useProfile()
  const accounts = useAccounts()
  const categories = useCategories()
  const monthTransactions = useTransactions(month)
  const movements = useBalanceMovements()
  const transfers = useTransfers()
  const purchases = usePurchases()

  const queries = [accounts, categories, monthTransactions, movements, transfers, purchases]
  const isPending = queries.some((query) => query.isPending)
  const error = queries.find((query) => query.error)?.error
  const currency = profile.data?.moeda === 'EUR' ? 'EUR' : 'BRL'
  const firstName = profile.data?.nome.split(' ')[0]

  const header = (
    <>
      <PageHeader
        title="Início"
        description={
          firstName
            ? `Olá, ${firstName}. Este é o resumo das tuas finanças.`
            : 'Resumo das tuas finanças.'
        }
      />
      <MonthPicker month={month} onChange={setMonth} className="mb-6 max-sm:justify-center" />
    </>
  )

  if (isPending) {
    return (
      <>
        {header}
        <p role="status" className="text-sm text-muted-foreground">
          A carregar o resumo…
        </p>
      </>
    )
  }

  if (error) {
    return (
      <>
        {header}
        <div className="grid gap-3">
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
  const balanceMovements = [...allMovements, ...transferMovements(transfers.data ?? [])]
  const saldoAtual = totalBalance(allAccounts, balanceMovements, { today })
  const saldoPrevisto = totalBalance(allAccounts, balanceMovements, { today, includeFuture: true })
  const balances = balancesByAccount(allAccounts, balanceMovements, { today })
  // D4a: com cartões, o número principal é o dinheiro disponível (sem a dívida dos cartões)
  const hasCards = allAccounts.some(isCreditCard)
  const position = netPosition(allAccounts, balanceMovements, { today })
  const positionPrevista = netPosition(allAccounts, balanceMovements, {
    today,
    includeFuture: true,
  })
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
  const parcelasByPurchase = new Map(
    (purchases.data ?? []).map((purchase) => [purchase.id, purchase.parcelas]),
  )
  const monthLabel = month === currentMonth() ? 'este mês' : formatMonth(month)
  const transactionsLink = month === currentMonth() ? '/transacoes' : `/transacoes?mes=${month}`

  return (
    <>
      {header}

      {hasCards && (
        <div className="mb-3 grid grid-cols-2 gap-3">
          <StatTile
            hero
            label="Dinheiro disponível"
            icon={Wallet}
            value={formatMoney(position.disponivel, currency)}
            hint={
              positionPrevista.disponivel !== position.disponivel
                ? `Previsto com transações futuras: ${formatMoney(positionPrevista.disponivel, currency)}`
                : 'Nas tuas contas, sem os cartões, até hoje.'
            }
            className="col-span-2"
          />
          <StatTile
            label={position.dividaCartoes < 0 ? 'Crédito nos cartões' : 'Dívida nos cartões'}
            icon={CreditCard}
            value={formatMoney(Math.abs(position.dividaCartoes), currency)}
            hint={
              positionPrevista.dividaCartoes !== position.dividaCartoes
                ? `Com as parcelas futuras: ${formatMoney(positionPrevista.dividaCartoes, currency)}`
                : 'Compras até hoje que ainda não pagaste.'
            }
          />
          <StatTile
            label="Saldo líquido"
            icon={Landmark}
            value={formatMoney(position.liquido, currency)}
            hint={
              positionPrevista.liquido !== position.liquido
                ? `Previsto: ${formatMoney(positionPrevista.liquido, currency)}`
                : 'Dinheiro menos a dívida dos cartões.'
            }
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {!hasCards && (
          <StatTile
            hero
            label="Saldo atual"
            icon={Wallet}
            value={formatMoney(saldoAtual, currency)}
            hint={
              saldoPrevisto !== saldoAtual
                ? `Previsto com transações futuras: ${formatMoney(saldoPrevisto, currency)}`
                : 'Soma de todas as contas, até hoje.'
            }
            className="col-span-2 sm:col-span-3"
          />
        )}
        <StatTile
          label={`Receitas · ${monthLabel}`}
          icon={ArrowUpRight}
          value={formatMoney(summary.receitas, currency)}
          hint={vsPrevious('receitas')}
        />
        <StatTile
          label={`Despesas · ${monthLabel}`}
          icon={ArrowDownRight}
          value={formatMoney(summary.despesas, currency)}
          hint={vsPrevious('despesas')}
        />
        <StatTile
          label={`Resultado · ${monthLabel}`}
          icon={Scale}
          value={formatMoney(summary.resultado, currency, { signDisplay: 'exceptZero' })}
          hint={
            <>
              {summary.resultado > 0 && <p>Ganhaste mais do que gastaste.</p>}
              {summary.resultado < 0 && <p>Gastaste mais do que ganhaste.</p>}
              <p>{vsPrevious('resultado')}</p>
            </>
          }
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <MonthlyComparisonPanel series={series} currency={currency} />
        <BalanceEvolutionPanel
          points={balancePoints}
          currency={currency}
          hasAccounts={allAccounts.length > 0}
        />

        <Panel title="Gastos por categoria">
          {spending.length === 0 && (
            <p className="mb-2 text-sm text-muted-foreground">
              Sem despesas em {formatMonth(month)}.
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
              Sem transações em {formatMonth(month)}.{' '}
              <Link
                to={transactionsLink}
                className="font-medium text-foreground underline underline-offset-4"
              >
                Registar
              </Link>
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
                        ? parcelasByPurchase.get(transaction.compra_id)
                        : undefined
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
              Gerir
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
