import type { ReactNode } from 'react'

/** Cartão com título do Início. É uma região com nome: leitores de ecrã e testes encontram-na. */
export function Panel({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section aria-label={title} className="min-w-0 rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-medium">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}
