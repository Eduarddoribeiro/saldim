import { CreditCard } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { Account } from '@/features/accounts/accounts-api'
import type { CardPurchase } from '@/features/card-purchases/purchases-api'
import type { Category } from '@/features/categories/categories-api'
import { useCurrency } from '@/features/profile/hooks'
import { todayIso } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useInvoiceData } from './hooks'
import { InvoiceDetailsDialog } from './InvoiceDetailsDialog'
import { dayMonth, invoiceTitle } from './invoice-options'
import { dueSoon, summarizeInvoices } from './invoice-summary'

/**
 * Aviso no Início: faturas vencidas ou a vencer nos próximos 7 dias, cada uma com "Pagar", que abre
 * logo o pagamento já preenchido (valor em aberto, conta de pagamento do cartão, hoje): 2 toques.
 * Sem faturas nessa situação (ou se os dados falharem), não mostra nada: o Início não fica mais longo.
 */
export function DueInvoices({
  accounts,
  categories,
  purchases,
}: {
  accounts: Account[]
  categories: Category[]
  purchases: CardPurchase[]
}) {
  const currency = useCurrency()
  const { invoices, items, payments } = useInvoiceData()
  const [paying, setPaying] = useState<string | null>(null)
  if (!invoices.data || !items.data || !payments.data) return null

  const today = todayIso()
  const due = dueSoon(summarizeInvoices(invoices.data, items.data, payments.data, today), today)
  if (due.length === 0) return null
  const cardsById = new Map(accounts.map((account) => [account.id, account]))
  const opened = due.find((invoice) => invoice.id === paying) ?? null

  return (
    <section aria-label="Faturas a pagar" className="mb-4 grid gap-2">
      {due.map((invoice) => {
        const card = cardsById.get(invoice.account_id)
        const overdue = invoice.data_vencimento < today
        const when = overdue
          ? `Venceu ${dayMonth(invoice.data_vencimento)}`
          : invoice.data_vencimento === today
            ? 'Vence hoje'
            : `Vence ${dayMonth(invoice.data_vencimento)}`
        return (
          <div
            key={invoice.id}
            className={cn(
              'flex items-center gap-3 rounded-2xl border bg-card p-3 pl-4',
              overdue && 'border-destructive/40',
            )}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CreditCard className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {invoiceTitle(invoice.mes_referencia)} · {card?.nome ?? 'Cartão'}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                <span className={cn(overdue && 'font-medium text-destructive')}>{when}</span> ·{' '}
                <span className="tabular-nums">
                  {formatMoney(invoice.emAbertoCentavos, currency)}
                </span>
              </p>
            </div>
            <Button
              size="lg"
              className="shrink-0 rounded-full"
              onClick={() => setPaying(invoice.id)}
              aria-label={`Pagar ${invoiceTitle(invoice.mes_referencia).toLowerCase()} do ${card?.nome ?? 'cartão'}`}
            >
              Pagar
            </Button>
          </div>
        )
      })}

      <InvoiceDetailsDialog
        open={opened !== null}
        onOpenChange={(open) => !open && setPaying(null)}
        invoice={opened}
        card={opened ? cardsById.get(opened.account_id) : undefined}
        accounts={accounts}
        categories={categories}
        purchases={purchases}
        startPaying
      />
    </section>
  )
}
