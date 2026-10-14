import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

type Option<T extends string> = { value: T; label: string }

/**
 * Escolha única entre poucas opções (ex.: Despesa | Receita), feita com rádios nativos:
 * acessível por teclado (setas) e compatível com `{...register('campo')}`.
 */
export function SegmentedControl<T extends string>({
  legend,
  options,
  name,
  className,
  ...inputProps
}: {
  legend: string
  options: Option<T>[]
  name: string
  className?: string
} & Omit<ComponentProps<'input'>, 'type' | 'value' | 'className'>) {
  return (
    <fieldset className={cn('grid gap-1.5', className)}>
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-1">
        {options.map((option) => (
          <label key={option.value} className="relative">
            <input
              type="radio"
              name={name}
              value={option.value}
              className="peer sr-only"
              {...inputProps}
            />
            <span
              className={cn(
                'flex h-9 cursor-pointer items-center justify-center rounded-md text-sm font-medium text-muted-foreground transition-colors',
                'peer-checked:bg-background peer-checked:text-foreground peer-checked:shadow-sm',
                'peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50',
                'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
              )}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
