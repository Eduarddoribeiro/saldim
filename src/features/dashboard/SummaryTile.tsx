import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'

/**
 * Um bloco compacto do Início: ícone, nome, o número e uma linha; um toque abre o detalhe. O nome
 * acessível começa pelo texto visível.
 */
export function SummaryTile({
  to,
  icon: Icon,
  label,
  value,
  sub,
  tone,
  ariaLabel,
  children,
  className,
}: {
  to: string
  icon: LucideIcon
  label: string
  value: string
  sub?: string
  tone?: 'positive' | 'negative'
  ariaLabel: string
  children?: ReactNode
  className?: string
}) {
  return (
    <Link
      to={to}
      aria-label={ariaLabel}
      className={cn(
        'grid min-w-0 content-start gap-1 rounded-2xl border bg-card p-3.5 transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        className,
      )}
    >
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="truncate">{label}</span>
      </span>
      <span
        className={cn(
          'truncate text-lg font-semibold tracking-tight tabular-nums',
          tone === 'positive' && 'text-positive',
          tone === 'negative' && 'text-destructive',
        )}
      >
        {value}
      </span>
      {sub && <span className="line-clamp-2 text-xs text-muted-foreground">{sub}</span>}
      {children}
    </Link>
  )
}
