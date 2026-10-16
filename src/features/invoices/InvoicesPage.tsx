import { ChevronRight, CreditCard, ReceiptText } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { FormAlert } from '@/components/form/FormAlert'
import { EmptyState } from '@/components/layout/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button, buttonVariants } from '@/components/ui/button'
import { isCreditCard } from '@/features/accounts/account-options'
import { useAccounts } from '@/features/accounts/hooks'
import { usePurchases } from '@/features/card-purchases/hooks'
import { useCategories } from '@/features/categories/hooks'
import { useCurrency } from '@/features/profile/hooks'
import { todayIso } from '@/lib/dates'
import { errorMessage } from '@/lib/db-errors'
import { formatMoney, type Currency } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useInvoiceData } from './hooks'
import { InvoiceDetailsDialog, type InvoiceView } from './InvoiceDetailsDialog'
import {
  INVOICE_STATE_CLASSES,
  INVOICE_STATE_LABELS,
  dayMonth,
  invoiceMonth,
  invoiceTitle,
} from './invoice-options'
import { isToPay, summarizeInvoices } from './invoice-summary'

type Filter = 'por_pagar' | 'pagas' | 'todas'
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'por_pagar', label: 'Por pagar' },
  { value: 'pagas', label: 'Pagas' },
  { value: 'todas', label: 'Todas' },
]

export function InvoicesPage() {
  const accounts = useAccounts()
  const categories = useCategories()
  const purchases = usePurchases()
  const { invoices, items, payments } = useInvoiceData()
  const currency = useCurrency()
  const [chosenCardId, setChosenCardId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('por_pagar')
  const [openedId, setOpenedId] = useState<string | null>(null)

  const queries = [accounts, categories, purchases, invoices, items, payments]
  const isPending = queries.some((query) => query.isPending)
  const error = queries.find((query) => query.error)?.error

  const allAccounts = accounts.data ?? []
  // Cartões arquivados continuam aqui se tiverem faturas: a dívida não desaparece ao arquivar
  const cardIdsWithInvoices = new Set((invoices.data ?? []).map((invoice) => invoice.account_id))
  const cards = allAccounts.filter(
    (account) =>
      isCreditCard(account) && (!account.arquivada || cardIdsWithInvoices.has(account.id)),
  )
  const card = cards.find((account) => account.id === chosenCardId) ?? cards[0]

  const summaries: InvoiceView[] = summarizeInvoices(
    (invoices.data ?? []).filter((invoice) => invoice.account_id === card?.id),
    items.data ?? [],
    payments.data ?? [],
    todayIso(),
  )
  const visible = summaries
    .filter((invoice) =>
      filter === 'todas'
        ? true
        : filter === 'por_pagar'
          ? isToPay(invoice)
          : !isToPay(invoice) && invoice.estado !== 'sem_compras',
    )
    // Por pagar: a que vence primeiro em cima; nas outras, as mais recentes primeiro
    .sort((a, b) =>
      filter === 'por_pagar'
        ? a.mes_referencia.localeCompare(b.mes_referencia)
        : b.mes_referencia.localeCompare(a.mes_referencia),
    )
  const totalPorPagar = summaries
    .filter(isToPay)
    .reduce((total, invoice) => total + invoice.emAbertoCentavos, 0)
  const opened = summaries.find((invoice) => invoice.id === openedId) ?? null

  const header = (
    <PageHeader
      title="Faturas"
      description="As faturas dos teus cartões: o que fecha, o que vence e o que já pagaste."
    />
  )

  if (isPending) {
    return (
      <>
        {header}
        <p role="status" className="text-sm text-muted-foreground">
          A carregar faturas…
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

  if (!card) {
    return (
      <>
        {header}
        <EmptyState
          icon={CreditCard}
          title="Ainda não tens cartões de crédito"
          description="Cria um cartão em Configurações → Contas para registar compras e ver as faturas."
        />
        <Link
          to="/configuracoes/contas"
          className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}
        >
          Ir para as contas
        </Link>
      </>
    )
  }

  return (
    <>
      {header}

      <div className="mb-6 grid gap-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
        {cards.length > 1 ? (
          <div className="grid gap-1.5">
            <label htmlFor="faturas-cartao" className="text-sm font-medium">
              Cartão
            </label>
            <select
              id="faturas-cartao"
              value={card.id}
              onChange={(event) => setChosenCardId(event.target.value)}
              className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
            >
              {cards.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.nome}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="font-medium">{card.nome}</p>
        )}
        <p className="text-sm text-muted-foreground">
          Por pagar:{' '}
          <span className="font-medium text-foreground tabular-nums">
            {formatMoney(totalPorPagar, currency)}
          </span>
        </p>
      </div>

      <div
        role="group"
        aria-label="Mostrar faturas"
        className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 sm:w-fit"
      >
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={filter === option.value}
            onClick={() => setFilter(option.value)}
            className={cn(
              'h-9 rounded-md px-4 text-sm font-medium text-muted-foreground transition-colors',
              'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              'aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title={filter === 'por_pagar' ? 'Nada por pagar' : 'Sem faturas'}
          description={
            filter === 'por_pagar'
              ? 'As faturas deste cartão estão pagas. As compras novas aparecem aqui.'
              : 'As faturas aparecem quando registas uma compra no cartão.'
          }
        />
      ) : (
        <ul aria-label="Faturas" className="grid min-w-0 gap-2 *:min-w-0">
          {visible.map((invoice) => (
            <li key={invoice.id}>
              <InvoiceRow
                invoice={invoice}
                currency={currency}
                onSelect={() => setOpenedId(invoice.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <InvoiceDetailsDialog
        open={opened !== null}
        onOpenChange={(open) => !open && setOpenedId(null)}
        invoice={opened}
        card={card}
        accounts={allAccounts}
        categories={categories.data ?? []}
        purchases={purchases.data ?? []}
      />
    </>
  )
}

function InvoiceRow({
  invoice,
  currency,
  onSelect,
}: {
  invoice: InvoiceView
  currency: Currency
  onSelect: () => void
}) {
  const title = invoiceTitle(invoice.mes_referencia)
  const state = INVOICE_STATE_LABELS[invoice.estado]
  const partial = invoice.pagoCentavos > 0 && invoice.emAbertoCentavos > 0
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${title}: ${state.toLowerCase()}, total ${formatMoney(invoice.totalCentavos, currency)}${partial ? `, falta ${formatMoney(invoice.emAbertoCentavos, currency)}` : ''}. Ver detalhe`}
      className="flex min-h-16 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{invoiceMonth(invoice.mes_referencia)}</span>
        <span className="block truncate text-xs text-muted-foreground">
          Fecha {dayMonth(invoice.data_fechamento)} · vence {dayMonth(invoice.data_vencimento)}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              INVOICE_STATE_CLASSES[invoice.estado],
            )}
          >
            {state}
          </span>
          {partial && (
            <span className="text-xs text-muted-foreground">
              falta {formatMoney(invoice.emAbertoCentavos, currency)}
            </span>
          )}
        </span>
      </span>
      <span className="shrink-0 font-medium tabular-nums">
        {formatMoney(invoice.totalCentavos, currency)}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  )
}
