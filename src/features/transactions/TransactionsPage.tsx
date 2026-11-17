import { ArrowLeftRight, Repeat } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { FormAlert } from '@/components/form/FormAlert'
import { EmptyState } from '@/components/layout/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { MonthPicker } from '@/components/month/MonthPicker'
import { useMonthParam } from '@/components/month/use-month-param'
import { Button, buttonVariants } from '@/components/ui/button'
import { useAccounts } from '@/features/accounts/hooks'
import { usePurchases } from '@/features/card-purchases/hooks'
import { PurchaseDetailsDialog } from '@/features/card-purchases/PurchaseDetailsDialog'
import { useCategories } from '@/features/categories/hooks'
import { usePeople } from '@/features/people/hooks'
import { useCurrency } from '@/features/profile/hooks'
import { useQuickEntry } from '@/features/quick-entry/quick-entry-context'
import { formatDay, formatMonth } from '@/lib/dates'
import { errorMessage } from '@/lib/db-errors'
import { formatMoney, type Currency } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useTransactions } from './hooks'
import { groupByDay } from './group-by-day'
import { TransactionFormDialog } from './TransactionFormDialog'
import { TransactionRow } from './TransactionRow'
import { isPlainTransaction, type PlainTransaction } from './transaction-kind'

export function TransactionsPage() {
  const [month, setMonth] = useMonthParam()
  const transactions = useTransactions(month)
  const categories = useCategories()
  const accounts = useAccounts()
  const purchases = usePurchases()
  const people = usePeople()
  const currency = useCurrency()
  const [dialog, setDialog] = useState<{ open: boolean; transaction: PlainTransaction | null }>({
    open: false,
    transaction: null,
  })
  const openQuickEntry = useQuickEntry()
  // Compra aberta no detalhe (a partir de uma das suas parcelas)
  const [details, setDetails] = useState<{ open: boolean; purchaseId: string | null }>({
    open: false,
    purchaseId: null,
  })

  const categoriesById = new Map((categories.data ?? []).map((category) => [category.id, category]))
  const accountsById = new Map((accounts.data ?? []).map((account) => [account.id, account]))
  const purchasesById = new Map((purchases.data ?? []).map((purchase) => [purchase.id, purchase]))
  const isPending =
    transactions.isPending || categories.isPending || accounts.isPending || purchases.isPending
  const error = transactions.error ?? categories.error ?? accounts.error ?? purchases.error
  const openedPurchase = details.purchaseId ? purchasesById.get(details.purchaseId) : undefined
  const list = transactions.data ?? []

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <PageHeader title="Extrato" description="Tudo o que entrou e saiu em cada mês." />
        {/* Atalho para os lançamentos recorrentes (a página vive nas Configurações). Lançar é no `+` */}
        <Link
          to="/configuracoes/recorrentes"
          className={cn(
            buttonVariants({ variant: 'outline', size: 'lg' }),
            'shrink-0 rounded-full',
          )}
        >
          <Repeat aria-hidden />
          Recorrentes
        </Link>
      </div>

      <MonthPicker month={month} onChange={setMonth} className="mb-6 max-sm:justify-center" />

      {isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando transações…
        </p>
      ) : error ? (
        <div className="grid gap-3">
          <FormAlert>{errorMessage(error)}</FormAlert>
          <Button
            variant="outline"
            className="w-fit"
            onClick={() => {
              void transactions.refetch()
              void categories.refetch()
              void accounts.refetch()
              void purchases.refetch()
            }}
          >
            Tentar de novo
          </Button>
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title={`Nenhuma transação em ${formatMonth(month)}`}
          description="Registre uma receita, uma despesa ou uma compra no cartão."
          action={
            <Button size="lg" className="rounded-full" onClick={() => openQuickEntry()}>
              Novo lançamento
            </Button>
          }
        />
      ) : (
        <div className="grid min-w-0 gap-5 *:min-w-0">
          {/* min-w-0: sem isto, um texto longo alarga a grelha além do ecrã (scroll horizontal) */}
          {groupByDay(list).map(([day, items]) => (
            <section key={day} aria-labelledby={`dia-${day}`}>
              <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
                <h2
                  id={`dia-${day}`}
                  className="min-w-0 truncate text-sm font-medium text-muted-foreground first-letter:uppercase"
                >
                  {formatDay(day)}
                </h2>
                <DayTotal items={items} currency={currency} />
              </div>
              <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                {items.map((transaction) => (
                  <li key={transaction.id}>
                    <TransactionRow
                      transaction={transaction}
                      category={categoriesById.get(transaction.category_id)}
                      account={accountsById.get(transaction.account_id)}
                      currency={currency}
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
                        people.data?.find((person) => person.id === transaction.pessoa_id)?.nome
                      }
                      onSelect={() => {
                        // Parcelas e estornos abrem a compra; o resto edita-se no formulário
                        if (isPlainTransaction(transaction)) setDialog({ open: true, transaction })
                        else if (transaction.compra_id)
                          setDetails({ open: true, purchaseId: transaction.compra_id })
                      }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <TransactionFormDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        transaction={dialog.transaction}
        categories={categories.data ?? []}
        accounts={accounts.data ?? []}
      />

      <PurchaseDetailsDialog
        open={details.open && Boolean(openedPurchase)}
        onOpenChange={(open) => setDetails((current) => ({ ...current, open }))}
        purchase={openedPurchase ?? null}
        card={openedPurchase ? accountsById.get(openedPurchase.account_id) : undefined}
        category={openedPurchase ? categoriesById.get(openedPurchase.category_id) : undefined}
      />
    </>
  )
}

/** Saldo do dia (entradas − saídas), ao lado da data, como nos extratos dos bancos. */
function DayTotal({
  items,
  currency,
}: {
  items: { tipo: string; valor_centavos: number }[]
  currency: Currency
}) {
  const total = items.reduce(
    (sum, item) => sum + (item.tipo === 'despesa' ? -item.valor_centavos : item.valor_centavos),
    0,
  )
  return (
    <span
      aria-label={`Saldo do dia: ${formatMoney(total, currency, { signDisplay: 'exceptZero' })}`}
      className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums"
    >
      {formatMoney(total, currency, { signDisplay: 'exceptZero' })}
    </span>
  )
}
