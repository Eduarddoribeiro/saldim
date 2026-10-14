import type { CategorySpending } from '@/lib/finance'

export const OTHER_CATEGORIES_ID = '__outras__'

/**
 * Mantém as `limit` maiores categorias e junta o resto numa linha "Outras" — muitas barras
 * pequenas não se leem; a soma delas sim. A percentagem de "Outras" é a que falta para 100,
 * para os números visíveis somarem sempre 100 %.
 */
export function topCategories(spending: CategorySpending[], limit = 5): CategorySpending[] {
  if (spending.length <= limit + 1) return spending
  const top = spending.slice(0, limit)
  const rest = spending.slice(limit)
  const total = rest.reduce((sum, item) => sum + item.total, 0)
  const shownPercent = top.reduce((sum, item) => sum + item.percent, 0)
  return [
    ...top,
    { categoryId: OTHER_CATEGORIES_ID, total, percent: Math.max(0, 100 - shownPercent) },
  ]
}
