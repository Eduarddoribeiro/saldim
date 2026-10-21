import { ArrowLeftRight, CreditCard, Plus, Repeat } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { FormAlert } from '@/components/form/FormAlert'
import { EmptyState } from '@/components/layout/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { MonthPicker } from '@/components/month/MonthPicker'
import { useMonthParam } from '@/components/month/use-month-param'
import { Button, buttonVariants } from '@/components/ui/button'
import { isCreditCard } from '@/features/accounts/account-options'
import { useAccounts } from '@/features/accounts/hooks'
import { usePurchases } from '@/features/card-purchases/hooks'
import { PurchaseDetailsDialog } from '@/features/card-purchases/PurchaseDetailsDialog'
import { PurchaseFormDialog } from '@/features/card-purchases/PurchaseFormDialog'
import { useCategories } from '@/features/categories/hooks'
import { usePeople } from '@/features/people/hooks'
import { useCurrency } from '@/features/profile/hooks'
import { formatDay, formatMonth } from '@/lib/dates'
import { errorMessage } from '@/lib/db-errors'
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
        <PageHeader
          title="Transações"
          description="Receitas, despesas e compras no cartão de cada mês."
        />
        {/* No telemóvel os atalhos ocupam a largura toda, lado a lado, e afastam-se do seletor de mês */}
        <div className="flex flex-wrap gap-2 max-md:mb-4 max-sm:w-full">
          {/* Atalho para os lançamentos recorrentes (a página vive nas Configurações) */}
          <Link
            to="/configuracoes/recorrentes"
            // cn resolve o conflito border-transparent × border-border, como no <Button>
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'max-sm:flex-1')}
          >
            <Repeat aria-hidden />
            Recorrentes
          </Link>
          {hasCards && (
            <Button
              size="lg"
              variant="outline"
              onClick={() => setPurchaseFormOpen(true)}
              className="max-sm:flex-1"
            >
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
        />
      ) : (
        <div className="grid min-w-0 gap-6 *:min-w-0 max-md:pb-16">
          {/* min-w-0: sem isto, um texto longo alarga a grelha além do ecrã (scroll horizontal) */}
          {/* pb-16 no telemóvel: a última transação fica acima do botão flutuante, não por baixo dele */}
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
