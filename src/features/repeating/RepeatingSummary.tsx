import { ChevronRight, Repeat } from 'lucide-react'
import { Link } from 'react-router'
import { useCurrency } from '@/features/profile/hooks'
import { formatMoney } from '@/lib/money'
import { useRepeatingExpenses } from './hooks'

/** No Início: quanto custam por mês os gastos que se repetem; leva à página com a lista. */
export function RepeatingSummary() {
  const repeating = useRepeatingExpenses()
  const currency = useCurrency()
  if (!repeating.data || repeating.data.items.length === 0) return null
  const { items, totalMensal, percentual } = repeating.data
  const amount = formatMoney(totalMensal, currency)
  const share =
    percentual === null
      ? null
      : `${new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 }).format(percentual)} do que entra`
  const top = items
    .slice(0, 3)
    .map((item) => item.nome)
    .join(', ')

  return (
    <Link
      to="/gastos-fixos"
      aria-label={`Gastos que se repetem: ${amount} por mês${share ? `, ${share}` : ''}. Ver a lista`}
      className="mb-4 flex items-center gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Repeat className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">Gastos que se repetem</p>
        <p className="truncate text-lg font-semibold tracking-tight tabular-nums">
          {amount}
          <span className="text-sm font-normal text-muted-foreground"> /mês</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {[share, top].filter(Boolean).join(' · ')}
        </p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  )
}
