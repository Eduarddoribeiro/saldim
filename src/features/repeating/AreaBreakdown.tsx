import type { Category } from '@/features/categories/categories-api'
import { CategoryBadge } from '@/features/categories/CategoryBadge'
import { colorOf } from '@/features/categories/category-options'
import { cn } from '@/lib/utils'
import type { AreaRow } from './by-area'

const percent = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 }).format(value)

/**
 * Para onde vão os gastos que se repetem, por área: uma barra com a fatia de cada categoria (só
 * desenho; o que conta está escrito na lista) e a lista com o valor por mês, a percentagem e os
 * gastos de cada área. As barras da lista comparam-se com a maior.
 */
export function AreaBreakdown({
  rows,
  category,
  money,
}: {
  rows: AreaRow[]
  category: (id: string) => Pick<Category, 'nome' | 'cor' | 'icone'> | undefined
  money: (cents: number) => string
}) {
  if (rows.length === 0) return null
  const max = rows[0].mensal
  return (
    <section aria-labelledby="gastos-por-area" className="grid min-w-0 gap-3 *:min-w-0">
      <h2
        id="gastos-por-area"
        className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
      >
        Por área
      </h2>
      <div aria-hidden className="flex h-3 overflow-hidden rounded-full bg-muted">
        {rows.map((row) => (
          <span
            key={row.categoryId}
            className={cn('h-full', colorOf(category(row.categoryId)?.cor ?? 'slate').swatch)}
            style={{ width: `${row.share * 100}%` }}
          />
        ))}
      </div>
      <ul aria-label="Gastos por área" className="grid gap-3 rounded-2xl border bg-card p-4">
        {rows.map((row) => {
          const cat = category(row.categoryId)
          const nome = cat?.nome ?? 'Sem categoria'
          return (
            <li
              key={row.categoryId}
              className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1"
            >
              <CategoryBadge size="sm" cor={cat?.cor ?? 'slate'} icone={cat?.icone ?? 'tag'} />
              <div className="grid min-w-0 gap-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-medium">{nome}</span>
                  <span className="shrink-0 text-sm tabular-nums">
                    <span className="font-semibold">{money(row.mensal)}</span>
                    <span className="text-muted-foreground"> · {percent(row.share)}</span>
                  </span>
                </div>
                <div aria-hidden className="h-1.5 rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full', colorOf(cat?.cor ?? 'slate').swatch)}
                    style={{ width: `${Math.max(2, (row.mensal * 100) / max)}%` }}
                  />
                </div>
                <span className="truncate text-xs text-muted-foreground">
                  {row.nomes.join(', ')}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
