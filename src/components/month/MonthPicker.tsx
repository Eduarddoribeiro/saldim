import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { addMonths, currentMonth, formatMonth, type MonthKey } from '@/lib/dates'
import { cn } from '@/lib/utils'

/** Navegação entre meses: ‹ outubro de 2026 › (+ atalho para voltar ao mês atual). */
export function MonthPicker({
  month,
  onChange,
  className,
}: {
  month: MonthKey
  onChange: (month: MonthKey) => void
  className?: string
}) {
  const isCurrent = month === currentMonth()
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Button
        variant="outline"
        size="icon-lg"
        onClick={() => onChange(addMonths(month, -1))}
        aria-label={`Mês anterior (${formatMonth(addMonths(month, -1))})`}
      >
        <ChevronLeft aria-hidden />
      </Button>
      {/* aria-live: quem usa leitor de ecrã ouve o novo mês ao mudar */}
      <p aria-live="polite" className="min-w-40 text-center font-medium first-letter:uppercase">
        {formatMonth(month)}
      </p>
      <Button
        variant="outline"
        size="icon-lg"
        onClick={() => onChange(addMonths(month, 1))}
        aria-label={`Mês seguinte (${formatMonth(addMonths(month, 1))})`}
      >
        <ChevronRight aria-hidden />
      </Button>
      {!isCurrent && (
        <Button variant="ghost" onClick={() => onChange(currentMonth())} className="ml-1">
          Hoje
        </Button>
      )}
    </div>
  )
}
