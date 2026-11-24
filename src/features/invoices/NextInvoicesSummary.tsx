import { CalendarClock, ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { usePeople } from '@/features/people/hooks'
import { useCurrency } from '@/features/profile/hooks'
import { formatMonth, todayIso } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { useInvoiceData } from './hooks'
import { summarizeInvoices } from './invoice-summary'
import { upcomingCardMonths } from './upcoming-months'
import { useProjectedCardCharges } from '@/features/recurring/use-projection'

/**
 * No Início: a próxima fatura (todos os cartões juntos) com a parte sua e de cada pessoa, e o mês
 * seguinte. Um toque abre o quadro completo em Cartões. Sem faturas por vir, não mostra nada.
 */
export function NextInvoicesSummary() {
  const currency = useCurrency()
  const people = usePeople()
  const { invoices, items, payments } = useInvoiceData()
  const projected = useProjectedCardCharges()
  if (!invoices.data || !items.data || !payments.data) return null

  const today = todayIso()
  const months = upcomingCardMonths(
    summarizeInvoices(invoices.data, items.data, payments.data, today),
    today,
    projected,
  )
  if (months.length === 0) return null
  const [next, after] = months
  const money = (cents: number) => formatMoney(cents, currency)
  const label = (month: string) => {
    const text = formatMonth(month)
    const short = month.slice(0, 4) === today.slice(0, 4) ? text.replace(/ de \d{4}$/, '') : text
    return short.charAt(0).toUpperCase() + short.slice(1)
  }
  const name = (id: string) =>
    people.data?.find((person) => person.id === id)?.nome ?? 'Outra pessoa'
  const split = [
    next.meu !== 0 ? `Seu ${money(next.meu)}` : null,
    ...next.pessoas.map((person) => `${name(person.pessoaId)} ${money(person.centavos)}`),
    next.previsto > 0 ? `inclui ${money(next.previsto)} previstos` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Link
      to="/faturas"
      aria-label={`Próximas faturas: ${label(next.month)} ${money(next.total)}, ${split}. Ver os meses`}
      className="mb-4 flex items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CalendarClock className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">Próximas faturas · {label(next.month)}</p>
        <p className="truncate text-lg font-semibold tracking-tight tabular-nums">
          {money(next.total)}
        </p>
        {split && <p className="truncate text-xs text-muted-foreground tabular-nums">{split}</p>}
        {after && (
          <p className="truncate text-xs text-muted-foreground tabular-nums">
            {label(after.month)}: {money(after.total)}
          </p>
        )}
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  )
}
