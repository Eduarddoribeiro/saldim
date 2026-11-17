import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Cartão com título do Início. É uma região com nome: leitores de ecrã e testes encontram-na. */
export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section aria-label={title} className={cn('min-w-0 rounded-2xl border bg-card p-4', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}
