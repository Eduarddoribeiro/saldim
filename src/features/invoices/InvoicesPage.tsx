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
import { usePeople } from '@/features/people/hooks'
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
import { isToPay, summarizeInvoices, totalsByPerson } from './invoice-summary'
import { UpcomingCardInvoices } from './UpcomingCardInvoices'
import { upcomingCardMonths } from './upcoming-months'

type Filter = 'por_pagar' | 'pagas' | 'todas'
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'por_pagar', label: 'A pagar' },
  { value: 'pagas', label: 'Pagas' },
  { value: 'todas', label: 'Todas' },
]
// Cada filtro vazio diz porquê: "Pagas" vazio não quer dizer que o cartão não tem faturas
const EMPTY_STATES: Record<Filter, { title: string; description: string }> = {
  por_pagar: {
    title: 'Nada a pagar',
    description: 'As faturas deste cartão estão pagas. As compras novas aparecem aqui.',
  },
  pagas: {
    title: 'Nenhuma fatura paga ainda',
    description: 'Quando você pagar uma fatura, ela aparece aqui.',
  },
  todas: {
    title: 'Nenhuma fatura ainda',
    description: 'As faturas aparecem quando você registra uma compra no cartão.',
  },
}

export function InvoicesPage() {
  const accounts = useAccounts()
  const categories = useCategories()
  const purchases = usePurchases()
  const { invoices, items, payments } = useInvoiceData()
  const currency = useCurrency()
  const people = usePeople()
  const personName = (id: string) =>
    people.data?.find((person) => person.id === id)?.nome ?? 'Outra pessoa'
  const [chosenCardId, setChosenCardId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('por_pagar')
  // Fatura aberta: no resumo, ou logo no pagamento (botão "Pagar" da linha)
  const [openedId, setOpenedId] = useState<string | null>(null)
  const [startPaying, setStartPaying] = useState(false)
  const open = (id: string, paying: boolean) => {
    setStartPaying(paying)
    setOpenedId(id)
  }

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
  // Todos os cartões juntos: quanto sai em cada mês que vem, e de quem é
  const upcoming = upcomingCardMonths(
    summarizeInvoices(invoices.data ?? [], items.data ?? [], payments.data ?? [], todayIso()),
    todayIso(),
  )
  const purchasesById = new Map((purchases.data ?? []).map((purchase) => [purchase.id, purchase]))

  const header = (
    <PageHeader
      title="Cartões"
      description="As faturas dos seus cartões: o que fecha, o que vence e o que você já pagou."
    />
  )

  if (isPending) {
    return (
      <>
        {header}
        <p role="status" className="text-sm text-muted-foreground">
          Carregando faturas…
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
          title="Você ainda não tem cartões de crédito"
          description="Cadastre um cartão de crédito para registrar compras e acompanhar as faturas."
        />
        <Link
          to="/configuracoes/contas"
          className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}
        >
          Criar cartão
        </Link>
      </>
    )
  }

  return (
    <>
      {header}

      <UpcomingCardInvoices
        months={upcoming}
        cardName={(id) => allAccounts.find((account) => account.id === id)?.nome ?? 'Cartão'}
        personName={personName}
        categoryName={(id) =>
          categories.data?.find((category) => category.id === id)?.nome ?? 'Compra no cartão'
        }
        totalParcelas={(id) => purchasesById.get(id)?.parcelas}
        currency={currency}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-[minmax(0,22rem)_1fr] sm:items-end">
        {/* O cartão desenhado como cartão: nome, quanto falta pagar e os dias de fecho/vencimento */}
        <div className="relative isolate grid aspect-[1.7] max-w-full content-between overflow-hidden rounded-2xl bg-linear-to-br from-hero to-hero-2 p-5 text-hero-foreground shadow-md">
          <span
            aria-hidden
            className="absolute -top-16 -right-14 -z-10 size-48 rounded-full bg-hero-accent/20"
          />
          <div className="flex items-start justify-between gap-3">
            <span aria-hidden className="h-6 w-9 rounded-md bg-hero-accent/70" />
            <p className="min-w-0 truncate text-right font-semibold">{card.nome}</p>
          </div>
          <div className="min-w-0">
            <p className="text-sm text-hero-foreground/80">
              A pagar:{' '}
              <span className="block truncate text-3xl font-bold tracking-tight text-hero-foreground tabular-nums">
                {formatMoney(totalPorPagar, currency)}
              </span>
            </p>
            {card.dia_fechamento && card.dia_vencimento && (
              <p className="mt-2 text-xs text-hero-foreground/80">
                Fecha dia {card.dia_fechamento} · vence dia {card.dia_vencimento}
              </p>
            )}
          </div>
        </div>
        {cards.length > 1 && (
          <div className="grid gap-1.5">
            <label htmlFor="faturas-cartao" className="text-sm font-medium">
              Cartão
            </label>
            <select
              id="faturas-cartao"
              value={card.id}
              onChange={(event) => setChosenCardId(event.target.value)}
              className="h-11 rounded-xl border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
            >
              {cards.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.nome}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div
        role="group"
        aria-label="Mostrar faturas"
        className="mb-4 grid grid-cols-3 gap-1 rounded-full bg-muted p-1 sm:w-fit"
      >
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={filter === option.value}
            onClick={() => setFilter(option.value)}
            className={cn(
              'h-9 rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors',
              'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              'aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={ReceiptText} {...EMPTY_STATES[filter]} />
      ) : (
        <ul aria-label="Faturas" className="grid min-w-0 gap-2 *:min-w-0">
          {visible.map((invoice) => (
            <li key={invoice.id}>
              <InvoiceRow
                invoice={invoice}
                currency={currency}
                onSelect={() => open(invoice.id, false)}
                onPay={() => open(invoice.id, true)}
                personName={personName}
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
        startPaying={startPaying}
      />
    </>
  )
}

function InvoiceRow({
  invoice,
  currency,
  onSelect,
  onPay,
  personName,
}: {
  invoice: InvoiceView
  currency: Currency
  onSelect: () => void
  onPay: () => void
  personName: (id: string) => string
}) {
  // T1: a parte de cada outra pessoa nesta fatura (ex.: "Mãe: R$ 79,15")
  const others = totalsByPerson(invoice.parcelas).filter((row) => row.pessoaId !== null)
  const title = invoiceTitle(invoice.mes_referencia)
  const state = INVOICE_STATE_LABELS[invoice.estado]
  const partial = invoice.pagoCentavos > 0 && invoice.emAbertoCentavos > 0
  const payable = invoice.totalCentavos > 0 && invoice.emAbertoCentavos > 0
  return (
    <div className="flex items-stretch overflow-hidden rounded-2xl border bg-card">
      <button
        type="button"
        onClick={onSelect}
        aria-label={`${title}: ${state.toLowerCase()}, total ${formatMoney(invoice.totalCentavos, currency)}${partial ? `, falta ${formatMoney(invoice.emAbertoCentavos, currency)}` : ''}${others.map((row) => `, ${personName(row.pessoaId ?? '')}: ${formatMoney(row.centavos, currency)}`).join('')}. Ver detalhes`}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{invoiceMonth(invoice.mes_referencia)}</span>
          <span className="block truncate text-xs text-muted-foreground">
            Fecha {dayMonth(invoice.data_fechamento)} · vence {dayMonth(invoice.data_vencimento)}
          </span>
          {others.length > 0 && (
            <span className="block truncate text-xs text-muted-foreground">
              {others
                .map(
                  (row) =>
                    `${personName(row.pessoaId ?? '')}: ${formatMoney(row.centavos, currency)}`,
                )
                .join(' · ')}
            </span>
          )}
          {/* Estado e valor na mesma linha: deixa a largura para o mês quando há o botão "Pagar" */}
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
            <span className="ml-auto shrink-0 font-semibold tabular-nums">
              {formatMoney(invoice.totalCentavos, currency)}
            </span>
          </span>
        </span>
        {!payable && <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
      </button>
      {payable && (
        <div className="flex items-center border-l pr-3 pl-3">
          <Button
            size="lg"
            className="rounded-full"
            onClick={onPay}
            aria-label={`Pagar ${invoiceTitle(invoice.mes_referencia).toLowerCase()}`}
          >
            Pagar
          </Button>
        </div>
      )}
    </div>
  )
}
