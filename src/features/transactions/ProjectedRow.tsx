import type { Account } from '@/features/accounts/accounts-api'
import type { Category } from '@/features/categories/categories-api'
import { CategoryBadge } from '@/features/categories/CategoryBadge'
import type { ProjectedOccurrence } from '@/features/recurring/projection'
import { formatMoney, type Currency } from '@/lib/money'
import { cn } from '@/lib/utils'

/**
 * Linha de um recorrente que ainda não foi lançado (só previsão): como as outras linhas do Extrato,
 * mas sem abrir nada e com o valor apagado. No dia, o lançamento real ocupa o seu lugar.
 */
export function ProjectedRow({
  occurrence,
  category,
  account,
  currency,
}: {
  occurrence: ProjectedOccurrence
  category: Category | undefined
  account: Account | undefined
  currency: Currency
}) {
  const credit = occurrence.tipo === 'receita'
  const title = occurrence.descricao || category?.nome || 'Recorrente'
  const amount = formatMoney(
    credit ? occurrence.valor_centavos : -occurrence.valor_centavos,
    currency,
    {
      signDisplay: 'always',
    },
  )
  const day = `${occurrence.data.slice(8, 10)}/${occurrence.data.slice(5, 7)}`
  const detail = [
    occurrence.atrasado
      ? 'Ainda não pago este mês · Só lembrar'
      : occurrence.lembrar
        ? `Por volta de ${day} · Só lembrar`
        : `Cai em ${day} · Recorrente · previsto`,
    occurrence.descricao ? category?.nome : null,
    account?.nome,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <div className="flex min-h-16 items-center gap-3 px-4 py-2.5">
      <CategoryBadge cor={category?.cor ?? 'slate'} icone={category?.icone ?? 'tag'} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        <span className="line-clamp-2 text-xs text-muted-foreground">{detail}</span>
      </span>
      <span
        className={cn(
          'shrink-0 text-right font-medium tabular-nums opacity-60',
          credit ? 'text-positive' : 'text-foreground',
        )}
      >
        <span className="sr-only">{credit ? 'Receita prevista de ' : 'Despesa prevista de '}</span>
        {amount}
      </span>
    </div>
  )
}
