import { CircleAlert, CircleCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Mensagem no topo de um formulário (erro do servidor ou confirmação). `role` faz o leitor de ecrã anunciá-la. */
export function FormAlert({
  variant = 'error',
  children,
}: {
  variant?: 'error' | 'success'
  children: ReactNode
}) {
  const Icon = variant === 'error' ? CircleAlert : CircleCheck
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
        variant === 'error'
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-border bg-muted text-foreground',
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  )
}
