import { cn } from '@/lib/utils'

/**
 * Ícone do Saldim: dois traços iguais, como um sinal de igual ("o saldo bate com o do banco").
 * O traço de cima usa as cores do tema; o de baixo é o verde da marca. Igual a public/favicon.svg.
 */
function AppMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <rect x="8" y="10.5" width="16" height="3.5" rx="1.75" className="fill-primary-foreground" />
      <rect x="8" y="18" width="16" height="3.5" rx="1.75" className="fill-brand" />
    </svg>
  )
}

export function AppLogo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 font-semibold tracking-tight', className)}>
      <AppMark />
      Saldim
    </div>
  )
}
