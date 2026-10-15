import { ArrowLeftRight, CreditCard, Plus } from 'lucide-react'
import { useState } from 'react'
import { FormAlert } from '@/components/form/FormAlert'
import { EmptyState } from '@/components/layout/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { MonthPicker } from '@/components/month/MonthPicker'
import { useMonthParam } from '@/components/month/use-month-param'
import { Button } from '@/components/ui/button'
import { isCreditCard } from '@/features/accounts/account-options'
import { useAccounts } from '@/features/accounts/hooks'
import { usePurchases } from '@/features/card-purchases/hooks'
import { PurchaseDetailsDialog } from '@/features/card-purchases/PurchaseDetailsDialog'
import { PurchaseFormDialog } from '@/features/card-purchases/PurchaseFormDialog'
import { useCategories } from '@/features/categories/hooks'
import { useCurrency } from '@/features/profile/hooks'
import { formatDay, formatMonth } from '@/lib/dates'
import { errorMessage } from '@/lib/db-errors'
import { useTransactions } from './hooks'
import { groupByDay } from './group-by-day'
import { TransactionFormDialog } from './TransactionFormDialog'
import { TransactionRow } from './TransactionRow'
import type { Transaction } from './transactions-api'

export function TransactionsPage() {
  const [month, setMonth] = useMonthParam()
  const transactions = useTransactions(month)
  const categories = useCategories()
  const accounts = useAccounts()
  const purchases = usePurchases()
  const currency = useCurrency()
  const [dialog, setDialog] = useState<{ open: boolean; transaction: Transaction | null }>({
    open: false,
    transaction: null,
  })
  const [purchaseFormOpen, setPurchaseFormOpen] = useState(false)
  // Compra aberta no detalhe (a partir de uma das suas parcelas)
  const [details, setDetails] = useState<{ open: boolean; purchaseId: string | null }>({
    open: false,
    purchaseId: null,
  })

  const categoriesById = new Map((categories.data ?? []).map((category) => [category.id, category]))
  const accountsById = new Map((accounts.data ?? []).map((account) => [account.id, account]))
  const purchasesById = new Map((purchases.data ?? []).map((purchase) => [purchase.id, purchase]))
  const hasCards = (accounts.data ?? []).some(
    (account) => isCreditCard(account) && !account.arquivada,
  )
  const isPending =
    transactions.isPending || categories.isPending || accounts.isPending || purchases.isPending
  const error = transactions.error ?? categories.error ?? accounts.error ?? purchases.error
  const openedPurchase = details.purchaseId ? purchasesById.get(details.purchaseId) : undefined
  const openNew = () => setDialog({ open: true, transaction: null })
  const list = transactions.data ?? []

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Transações" description="Receitas e despesas registadas." />
        <div className="flex flex-wrap gap-2">
          {hasCards && (
            <Button size="lg" variant="outline" onClick={() => setPurchaseFormOpen(true)}>
              <CreditCard aria-hidden />
              Compra no cartão
            </Button>
          )}
          <Button size="lg" onClick={openNew} className="max-md:hidden">
            <Plus aria-hidden />
            Nova transação
          </Button>
        </div>
      </div>

      <MonthPicker month={month} onChange={setMonth} className="mb-6 max-sm:justify-center" />

      {isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          A carregar transações…
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
          title={`Sem transações em ${formatMonth(month)}`}
          description="Regista uma receita ou uma despesa para começar."
        />
      ) : (
        <div className="grid min-w-0 gap-6 *:min-w-0">
          {/* min-w-0: sem isto, um texto longo alarga a grelha além do ecrã (scroll horizontal) */}
          {groupByDay(list).map(([day, items]) => (
            <section key={day} aria-labelledby={`dia-${day}`}>
              <h2
                id={`dia-${day}`}
                className="mb-2 text-sm font-medium text-muted-foreground first-letter:uppercase"
              >
                {formatDay(day)}
              </h2>
              <ul className="divide-y rounded-xl border">
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
                      onSelect={() =>
                        transaction.compra_id
                          ? setDetails({ open: true, purchaseId: transaction.compra_id })
                          : setDialog({ open: true, transaction })
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Botão flutuante no telemóvel: sempre ao alcance do polegar, acima da barra de navegação */}
      <Button
        size="icon-lg"
        onClick={openNew}
        aria-label="Nova transação"
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 size-14 rounded-full shadow-lg md:hidden"
      >
        <Plus className="size-6" aria-hidden />
      </Button>

      <TransactionFormDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        transaction={dialog.transaction}
        categories={categories.data ?? []}
        accounts={accounts.data ?? []}
      />

      <PurchaseFormDialog
        open={purchaseFormOpen}
        onOpenChange={setPurchaseFormOpen}
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
