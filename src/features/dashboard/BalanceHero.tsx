import type { ReactNode } from 'react'
import { PrivacyToggle } from '@/components/privacy/PrivacyToggle'

/**
 * Faixa do topo do Início, como nos apps de banco: saudação, o olho (esconder valores) e o número
 * principal em destaque. No telemóvel ocupa a largura toda; no desktop é um cartão.
 */
export function BalanceHero({ greeting, children }: { greeting: string; children?: ReactNode }) {
  return (
    <section
      aria-label="Resumo"
      className="-mx-4 -mt-6 bg-linear-to-b from-hero to-hero-2 px-4 pt-3 pb-12 text-hero-foreground md:mx-0 md:mt-0 md:rounded-3xl md:px-6 md:pt-4"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-semibold"
        >
          {greeting
            .replace(/^Olá,?\s*/, '')
            .charAt(0)
            .toUpperCase() || 'S'}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="sr-only">Início</h1>
          <p className="truncate font-medium">{greeting}</p>
        </div>
        <PrivacyToggle className="-mr-2" />
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  )
}

/** O número principal da faixa (saldo ou dinheiro disponível) com a explicação por baixo. */
export function HeroNumber({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: ReactNode
}) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-hero-foreground/80">{label}</p>
      <p className="mt-1 truncate text-4xl font-bold tracking-tight tabular-nums" title={value}>
        {value}
      </p>
      {hint && <div className="mt-2 text-xs text-hero-foreground/80">{hint}</div>}
    </div>
  )
}

/** Número secundário da faixa (saldo líquido, dívida nos cartões), em letra mais pequena. */
export function HeroStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-hero-foreground/75">{label}</p>
      <p className="truncate text-lg font-semibold tracking-tight tabular-nums" title={value}>
        {value}
      </p>
      {hint && <p className="text-[11px] leading-snug text-hero-foreground/70">{hint}</p>}
    </div>
  )
}
