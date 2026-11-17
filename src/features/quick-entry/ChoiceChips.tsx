import type { LucideIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export type ChipOption = { value: string; label: string; icon?: LucideIcon }

/**
 * Escolha única em "pílulas" (contas, datas): rádios nativos, acessíveis por teclado e compatíveis com
 * `{...register('campo')}` ou controlados (`selected` + `onChange`).
 */
export function ChoiceChips({
  legend,
  options,
  error,
  errorId,
  selected,
  className,
  ...inputProps
}: {
  legend: string
  /** Valor escolhido, quando a escolha é controlada (sem register) */
  selected?: string
  options: ChipOption[]
  error?: string
  errorId?: string
  className?: string
} & Omit<ComponentProps<'input'>, 'type' | 'value' | 'className'>) {
  return (
    <fieldset
      aria-describedby={error ? errorId : undefined}
      className={cn('grid gap-2', className)}
    >
      <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {legend}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map(({ value, label, icon: Icon }) => (
          <label key={value} className="min-w-0 cursor-pointer">
            <input
              type="radio"
              value={value}
              className="peer sr-only"
              {...inputProps}
              {...(selected !== undefined && { checked: selected === value })}
            />
            <span
              className={cn(
                'flex min-h-11 max-w-full items-center gap-2 rounded-full border bg-background px-4 text-sm font-medium transition-colors',
                'peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-foreground',
                'peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50',
              )}
            >
              {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
              <span className="truncate">{label}</span>
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  )
}
