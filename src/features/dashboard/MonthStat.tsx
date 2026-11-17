import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Um número do cartão "Este mês" (receitas, despesas, resultado), com a comparação por baixo. */
export function MonthStat({
  label,
  value,
  icon: Icon,
  hint,
  tone,
  className,
}: {
  label: string
  value: string
  icon: LucideIcon
  hint?: ReactNode
  /** Cor do número: verde para o que entra */
  tone?: 'positive'
  className?: string
}) {
  return (
    <div className={cn('min-w-0 rounded-xl bg-muted/60 px-3 py-2.5', className)}>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 truncate text-lg font-semibold tracking-tight tabular-nums',
          tone === 'positive' && 'text-positive',
        )}
        title={value}
      >
        {value}
      </p>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}
