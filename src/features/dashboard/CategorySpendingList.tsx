import type { Category } from '@/features/categories/categories-api'
import { CategoryBadge } from '@/features/categories/CategoryBadge'
import type { CategorySpending } from '@/lib/finance'
import { formatMoney, type Currency } from '@/lib/money'
import { OTHER_CATEGORIES_ID, topCategories } from './category-ranking'

/**
 * Gastos por categoria como barras horizontais ordenadas (não uma rosca: comparar fatias parecidas
 * é difícil; comparar comprimentos é fácil). Uma só cor nas barras — a identidade está no ícone e no
 * nome escritos ao lado, por isso nada depende só da cor. É uma lista: leitores de ecrã leem tudo.
 */
export function CategorySpendingList({
  spending,
  categoriesById,
  currency,
}: {
  spending: CategorySpending[]
  categoriesById: Map<string, Category>
  currency: Currency
}) {
  const rows = topCategories(spending)
  const max = rows.reduce((biggest, row) => Math.max(biggest, row.total), 0)

  return (
    <ul className="grid gap-3">
      {rows.map((row) => {
        const category = categoriesById.get(row.categoryId)
        const isOther = row.categoryId === OTHER_CATEGORIES_ID
        const name = isOther ? 'Outras categorias' : (category?.nome ?? 'Sem categoria')
        // Largura relativa à maior barra (a maior ocupa a linha toda); mínimo visível de 2 %.
        const width = max > 0 ? Math.max(2, Math.round((row.total * 100) / max)) : 0
        return (
          <li
            key={row.categoryId}
            className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3"
          >
            <CategoryBadge
              size="sm"
              cor={isOther ? 'slate' : (category?.cor ?? 'slate')}
              icone={isOther ? 'tag' : (category?.icone ?? 'tag')}
              className="row-span-2"
            />
            <div className="flex min-w-0 items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-medium">{name}</span>
              <span className="shrink-0 tabular-nums">
                {formatMoney(row.total, currency)}
                <span className="ml-1.5 text-muted-foreground">{row.percent}%</span>
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-primary/80" style={{ width: `${width}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
