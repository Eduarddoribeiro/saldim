import { MoreHorizontal } from 'lucide-react'
import { useState, type ComponentProps } from 'react'
import type { Category } from '@/features/categories/categories-api'
import { CategoryBadge } from '@/features/categories/CategoryBadge'
import { cn } from '@/lib/utils'

/** Quantas categorias se veem antes de "Mais…" (duas linhas de quatro no telemóvel). */
export const VISIBLE_CATEGORIES = 8

/**
 * Categorias em botões com ícone e cor, já ordenadas (as mais usadas primeiro). São rádios nativos:
 * um toque escolhe, as setas do teclado também, e funciona com `{...register('categoryId')}`.
 */
export function CategoryPicker({
  categories,
  selectedId,
  error,
  ...inputProps
}: {
  categories: Category[]
  selectedId: string
  error?: string
} & Omit<ComponentProps<'input'>, 'type' | 'value'>) {
  const [expanded, setExpanded] = useState(false)
  const hasMore = categories.length > VISIBLE_CATEGORIES
  // A escolhida fica sempre visível, mesmo que esteja depois das primeiras oito
  const visible =
    expanded || !hasMore
      ? categories
      : categories.filter(
          (category, index) => index < VISIBLE_CATEGORIES - 1 || category.id === selectedId,
        )
  const errorId = error ? 'lancamento-categoria-erro' : undefined

  return (
    <fieldset aria-describedby={errorId} className="grid gap-2">
      <legend className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Categoria
      </legend>
      <div className="grid grid-cols-4 gap-x-1 gap-y-3">
        {visible.map((category) => (
          <label
            key={category.id}
            className="group grid min-w-0 cursor-pointer justify-items-center gap-1 text-center"
          >
            <input
              type="radio"
              value={category.id}
              className="peer sr-only"
              aria-invalid={error ? true : undefined}
              {...inputProps}
            />
            <CategoryBadge
              cor={category.cor}
              icone={category.icone}
              className={cn(
                'size-12 rounded-2xl ring-offset-2 ring-offset-popover transition-shadow [&_svg]:size-5',
                'peer-checked:ring-2 peer-checked:ring-primary peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50',
              )}
            />
            <span className="w-full truncate text-xs font-medium peer-checked:text-foreground">
              {category.nome}
            </span>
          </label>
        ))}
        {hasMore && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="grid min-w-0 justify-items-center gap-1 text-center focus-visible:outline-none [&:focus-visible>span:first-child]:ring-3 [&:focus-visible>span:first-child]:ring-ring/50"
          >
            <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <MoreHorizontal className="size-5" aria-hidden />
            </span>
            <span className="text-xs font-medium">Mais…</span>
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  )
}
