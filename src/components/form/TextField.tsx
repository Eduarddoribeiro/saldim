import type { ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type TextFieldProps = ComponentProps<'input'> & {
  id: string
  label: string
  error?: string
  hint?: string
}

/**
 * Campo de texto acessível: liga label ↔ input e anuncia o erro a leitores de ecrã
 * (aria-invalid + aria-describedby). Funciona com `{...register('campo')}` do React Hook Form.
 */
export function TextField({ id, label, error, hint, className, ...inputProps }: TextFieldProps) {
  const hintId = hint ? `${id}-dica` : undefined
  const errorId = error ? `${id}-erro` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        // h-10: área de toque confortável no telemóvel
        className={cn('h-10', className)}
        {...inputProps}
      />
      {hint && !error && (
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
