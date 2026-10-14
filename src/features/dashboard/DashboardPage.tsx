import { ArrowDownRight, ArrowUpRight, ChevronRight, Scale, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { FormAlert } from '@/components/form/FormAlert'
import { PageHeader } from '@/components/layout/PageHeader'
import { MonthPicker } from '@/components/month/MonthPicker'
import { useMonthParam } from '@/components/month/use-month-param'
import { Button } from '@/components/ui/button'
import { TIPO_CONTA_OPTIONS } from '@/features/accounts/account-options'
import { useAccounts } from '@/features/accounts/hooks'
import { useCategories } from '@/features/categories/hooks'
import { useProfile } from '@/features/profile/hooks'
import { useBalanceMovements, useTransactions } from '@/features/transactions/hooks'
import { TransactionRow } from '@/features/transactions/TransactionRow'
import { currentMonth, formatMonth, todayIso } from '@/lib/dates'
import { errorMessage } from '@/lib/db-errors'
import { balancesByAccount, monthSummary, spendingByCategory, totalBalance } from '@/lib/finance'
import { formatMoney } from '@/lib/money'
import { CategorySpendingList } from './CategorySpendingList'
import { StatTile } from './StatTile'

function Panel({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section aria-label={title} className="min-w-0 rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-medium">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function DashboardPage() {
  const [month, setMonth] = useMonthParam()
  const profile = useProfile()
  const accounts = useAccounts()
  const categories = useCategories()
  const monthTransactions = useTransactions(month)
  const movements = useBalanceMovements()

  const queries = [accounts, categories, monthTransactions, movements]
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
  const saldoAtual = totalBalance(allAccounts, allMovements, { today })
  const saldoPrevisto = totalBalance(allAccounts, allMovements, { today, includeFuture: true })
  const balances = balancesByAccount(allAccounts, allMovements, { today })
  const transactions = monthTransactions.data ?? []
  const summary = monthSummary(transactions, month)
  const spending = spendingByCategory(transactions, month)
  const categoriesById = new Map((categories.data ?? []).map((category) => [category.id, category]))
  const accountsById = new Map(allAccounts.map((account) => [account.id, account]))
  const monthLabel = month === currentMonth() ? 'este mês' : formatMonth(month)
  const transactionsLink = month === currentMonth() ? '/transacoes' : `/transacoes?mes=${month}`

  return (
    <>
      {header}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
        <StatTile
          label={`Receitas · ${monthLabel}`}
          icon={ArrowUpRight}
          value={formatMoney(summary.receitas, currency)}
        />
        <StatTile
          label={`Despesas · ${monthLabel}`}
          icon={ArrowDownRight}
          value={formatMoney(summary.despesas, currency)}
        />
        <StatTile
          label={`Resultado · ${monthLabel}`}
          icon={Scale}
          value={formatMoney(summary.resultado, currency, { signDisplay: 'exceptZero' })}
          hint={
            summary.resultado > 0
              ? 'Ganhaste mais do que gastaste.'
              : summary.resultado < 0
                ? 'Gastaste mais do que ganhaste.'
                : undefined
          }
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Gastos por categoria">
          {spending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem despesas em {formatMonth(month)}.</p>
          ) : (
            <CategorySpendingList
              spending={spending}
              categoriesById={categoriesById}
              currency={currency}
            />
          )}
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
