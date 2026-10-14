import { Copy, Target } from 'lucide-react'
import { useState } from 'react'
import { FormAlert } from '@/components/form/FormAlert'
import { EmptyState } from '@/components/layout/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { MonthPicker } from '@/components/month/MonthPicker'
import { useMonthParam } from '@/components/month/use-month-param'
import { Button } from '@/components/ui/button'
import type { Category } from '@/features/categories/categories-api'
import { CategoryBadge } from '@/features/categories/CategoryBadge'
import { useCategories } from '@/features/categories/hooks'
import { useCurrency } from '@/features/profile/hooks'
import { useTransactions } from '@/features/transactions/hooks'
import { addMonths, formatMonth } from '@/lib/dates'
import { errorMessage } from '@/lib/db-errors'
import { budgetStatus, spendingByCategory } from '@/lib/finance'
import { formatMoney, type Currency } from '@/lib/money'
import { cn } from '@/lib/utils'
import { BudgetFormDialog } from './BudgetFormDialog'
import { BUDGET_STATE } from './budget-status'
import type { Budget } from './budgets-api'
import { useBudgets, useCopyBudgets } from './hooks'

export function BudgetsPage() {
  const [month, setMonth] = useMonthParam()
  const previousMonth = addMonths(month, -1)
  const budgets = useBudgets(month)
  const previousBudgets = useBudgets(previousMonth)
  const categories = useCategories()
  const transactions = useTransactions(month)
  const currency = useCurrency()
  const copy = useCopyBudgets()
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const [dialog, setDialog] = useState<{
    open: boolean
    category: Category | null
    budget: Budget | null
  }>({ open: false, category: null, budget: null })

  const queries = [budgets, categories, transactions]
  const isPending = queries.some((query) => query.isPending)
  const error = queries.find((query) => query.error)?.error

  // Gasto por categoria no mês: regra única de src/lib/finance.ts
  const spent = new Map(
    spendingByCategory(transactions.data ?? [], month).map((item) => [item.categoryId, item.total]),
  )
  const budgetByCategory = new Map(
    (budgets.data ?? []).map((budget) => [budget.category_id, budget]),
  )
  const expenseCategories = (categories.data ?? []).filter(
    (category) => category.tipo === 'despesa',
  )
  // Com orçamento: todas as que o têm (mesmo arquivadas); sem orçamento: só as ativas
  const withBudget = expenseCategories.filter((category) => budgetByCategory.has(category.id))
  const withoutBudget = expenseCategories.filter(
    (category) => !budgetByCategory.has(category.id) && !category.arquivada,
  )
  const missingFromPrevious = (previousBudgets.data ?? []).filter(
    (budget) => !budgetByCategory.has(budget.category_id),
  ).length

  const totalLimit = withBudget.reduce(
    (sum, c) => sum + budgetByCategory.get(c.id)!.limite_centavos,
    0,
  )
  const totalSpent = withBudget.reduce((sum, c) => sum + (spent.get(c.id) ?? 0), 0)

  const open = (category: Category) =>
    setDialog({ open: true, category, budget: budgetByCategory.get(category.id) ?? null })

  return (
    <>
      <PageHeader title="Orçamentos" description="Limites mensais de gastos por categoria." />
      <MonthPicker month={month} onChange={setMonth} className="mb-6 max-sm:justify-center" />

      {isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          A carregar orçamentos…
        </p>
      ) : error ? (
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
      ) : (
        <div className="grid min-w-0 gap-6 *:min-w-0">
          {copyMessage && <FormAlert variant="success">{copyMessage}</FormAlert>}
          {copy.error && <FormAlert>{errorMessage(copy.error)}</FormAlert>}

          {missingFromPrevious > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed p-4">
              <p className="text-sm text-muted-foreground">
                {missingFromPrevious === 1
                  ? `1 orçamento de ${formatMonth(previousMonth)} ainda não está definido neste mês.`
                  : `${missingFromPrevious} orçamentos de ${formatMonth(previousMonth)} ainda não estão definidos neste mês.`}
              </p>
              <Button
                variant="outline"
                disabled={copy.isPending}
                onClick={async () => {
                  setCopyMessage(null)
                  const created = await copy
                    .mutateAsync({ from: previousMonth, to: month })
                    .catch(() => null)
                  if (created !== null) {
                    setCopyMessage(
                      created === 1 ? '1 orçamento copiado.' : `${created} orçamentos copiados.`,
                    )
                  }
                }}
              >
                <Copy aria-hidden />
                Copiar de {formatMonth(previousMonth)}
              </Button>
            </div>
          )}

          {withBudget.length === 0 ? (
            <EmptyState
              icon={Target}
              title={`Sem orçamentos em ${formatMonth(month)}`}
              description="Escolhe uma categoria abaixo e define quanto queres gastar no máximo."
            />
          ) : (
            <section aria-label="Com orçamento" className="grid gap-3">
              <p className="text-sm text-muted-foreground">
                Total:{' '}
                <span className="font-medium text-foreground tabular-nums">
                  {formatMoney(totalSpent, currency)}
                </span>{' '}
                gasto de <span className="tabular-nums">{formatMoney(totalLimit, currency)}</span>
              </p>
              <ul className="divide-y rounded-xl border">
                {withBudget.map((category) => (
                  <li key={category.id}>
                    <BudgetRow
                      category={category}
                      limite={budgetByCategory.get(category.id)!.limite_centavos}
                      gasto={spent.get(category.id) ?? 0}
                      currency={currency}
                      onSelect={() => open(category)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {withoutBudget.length > 0 && (
            <section aria-label="Sem orçamento">
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">Sem orçamento</h2>
              <ul className="divide-y rounded-xl border">
                {withoutBudget.map((category) => (
                  <li key={category.id} className="flex min-h-14 items-center gap-3 px-3">
                    <CategoryBadge size="sm" cor={category.cor} icone={category.icone} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{category.nome}</span>
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        Gasto: {formatMoney(spent.get(category.id) ?? 0, currency)}
                      </span>
                    </span>
                    {/* aria-label explícito: um espaço no início de texto sr-only perde-se no nome acessível */}
                    <Button
                      variant="outline"
                      aria-label={`Definir orçamento de ${category.nome}`}
                      onClick={() => open(category)}
                    >
                      Definir
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <BudgetFormDialog
        open={dialog.open}
        onOpenChange={(isOpen) => setDialog((current) => ({ ...current, open: isOpen }))}
        category={dialog.category}
        budget={dialog.budget}
        month={month}
      />
    </>
  )
}

function BudgetRow({
  category,
  limite,
  gasto,
  currency,
  onSelect,
}: {
  category: Category
  limite: number
  gasto: number
  currency: Currency
  onSelect: () => void
}) {
  const status = budgetStatus(limite, gasto)
  const state = BUDGET_STATE[status.estado]
  const StateIcon = state.icon
  return (
    <button
      type="button"
      onClick={onSelect}
      className="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 px-3 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none"
    >
      <CategoryBadge cor={category.cor} icone={category.icone} className="row-span-3" />
      <span className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2">
        <span className="max-w-full min-w-0 truncate font-medium">{category.nome}</span>
        <span className="shrink-0 text-sm tabular-nums">
          {formatMoney(gasto, currency)}
          <span className="text-muted-foreground"> de {formatMoney(limite, currency)}</span>
        </span>
      </span>
      <span
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={`Gasto de ${category.nome}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(status.percent, 100)}
        aria-valuetext={`${status.percent}% do limite`}
      >
        <span
          className={cn('block h-full rounded-full', state.bar)}
          style={{ width: `${Math.min(status.percent, 100)}%` }}
        />
      </span>
      <span className="flex flex-wrap items-center justify-between gap-x-2 text-xs">
        <span className={cn('inline-flex items-center gap-1 font-medium', state.text)}>
          <StateIcon className="size-3.5" aria-hidden />
          {state.label} · {status.percent}%
        </span>
        <span className="text-muted-foreground tabular-nums">
          {status.restante >= 0
            ? `Restam ${formatMoney(status.restante, currency)}`
            : `Passou ${formatMoney(-status.restante, currency)}`}
        </span>
      </span>
    </button>
  )
}
