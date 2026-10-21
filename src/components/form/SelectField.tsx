import { ChevronDown } from 'lucide-react'
import type { ComponentProps } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type SelectFieldProps = ComponentProps<'select'> & {
  id: string
  label: string
  error?: string
  /** Texto de ajuda por baixo (como no TextField) */
  hint?: string
  options: { value: string; label: string }[]
  /** Primeira opção vazia (ex.: "Escolhe uma categoria"): obriga a uma escolha consciente. */
  placeholder?: string
}

/**
 * Lista de escolha com <select> nativo: no telemóvel abre o seletor do sistema (mais fácil de usar
 * com o polegar) e é acessível sem trabalho extra. Funciona com `{...register('campo')}`.
 */
export function SelectField({
  id,
  label,
  error,
  hint,
  options,
  placeholder,
  className,
  ...selectProps
}: SelectFieldProps) {
  const hintId = hint ? `${id}-dica` : undefined
  const errorId = error ? `${id}-erro` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-10 w-full appearance-none rounded-lg border border-input bg-transparent pr-9 pl-2.5 text-base outline-none md:text-sm',
            'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
            'disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive dark:bg-input/30',
            className,
          )}
          {...selectProps}
        >
          {placeholder !== undefined && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
