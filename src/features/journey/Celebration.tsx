import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'

/**
 * O momento "boa!" (pedido de 2026-11-26): a estrela ganha, o que mudou e, se houver, quanto falta
 * para o próximo marco. Conteúdo de uma folha; quem a abre decide quando fechar.
 */
export function Celebration({
  title,
  subtitle,
  next,
  onContinue,
}: {
  title: string
  subtitle: string
  /** Próximo marco: texto e progresso de 0 a 1 */
  next?: { label: string; progress: number }
  onContinue: () => void
}) {
  return (
    <div className="grid justify-items-center gap-4 pb-2 text-center">
      <span
        aria-hidden
        className="flex size-20 items-center justify-center rounded-full bg-amber-400/15 text-amber-500 motion-safe:animate-pulse dark:text-amber-300"
      >
        <Star className="size-10 fill-current" />
      </span>
      <div className="grid gap-1">
        <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">{subtitle}</DialogDescription>
      </div>
      {next && (
        <div className="grid w-full gap-1.5 rounded-xl border p-3 text-left text-sm">
          <span>{next.label}</span>
          <div aria-hidden className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-amber-400"
              style={{ width: `${Math.round(Math.min(1, Math.max(0, next.progress)) * 100)}%` }}
            />
          </div>
        </div>
      )}
      <Button size="lg" variant="outline" className="h-12 w-full rounded-full" onClick={onContinue}>
        Continuar
      </Button>
    </div>
  )
}
