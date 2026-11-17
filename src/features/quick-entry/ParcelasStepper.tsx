import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MAX_PARCELAS } from '@/lib/credit-card'

/** Número de parcelas com − e + (1× à vista por omissão), em vez de uma lista de 48 opções. */
export function ParcelasStepper({
  value,
  onChange,
  error,
}: {
  value: number
  onChange: (value: number) => void
  error?: string
}) {
  const label = value === 1 ? '1× (à vista)' : `${value}×`
  return (
    <div role="group" aria-labelledby="lancamento-parcelas" className="grid gap-2">
      <span
        id="lancamento-parcelas"
        className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
      >
        Parcelas
      </span>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="size-11 rounded-full"
          aria-label="Menos uma parcela"
          disabled={value <= 1}
          onClick={() => onChange(value - 1)}
        >
          <Minus aria-hidden />
        </Button>
        <span aria-live="polite" className="min-w-24 text-center text-lg font-semibold">
          {label}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="size-11 rounded-full"
          aria-label="Mais uma parcela"
          disabled={value >= MAX_PARCELAS}
          onClick={() => onChange(value + 1)}
        >
          <Plus aria-hidden />
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
