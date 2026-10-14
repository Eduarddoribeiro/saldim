import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Cartão de um número principal (KPI). `hero` = o número que o ecrã destaca (saldo). */
export function StatTile({
  label,
  value,
  icon: Icon,
  hint,
  hero = false,
  className,
}: {
  label: string
  value: string
  icon?: LucideIcon
  hint?: ReactNode
  hero?: boolean
  className?: string
}) {
  return (
    <div className={cn('min-w-0 rounded-xl border bg-card p-4', className)}>
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {Icon && <Icon className="size-4" aria-hidden />}
        {label}
      </p>
      <p
        className={cn(
          'mt-1 truncate font-semibold tracking-tight tabular-nums',
          hero ? 'text-3xl sm:text-4xl' : 'text-lg sm:text-xl',
        )}
        title={value}
      >
        {value}
      </p>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}
