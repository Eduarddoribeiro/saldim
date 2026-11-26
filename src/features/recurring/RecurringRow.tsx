import { ChevronRight } from 'lucide-react'
import type { Category } from '@/features/categories/categories-api'
import { CategoryBadge } from '@/features/categories/CategoryBadge'
import { formatMoney, type Currency } from '@/lib/money'
import type { Recurring } from './recurring-api'
import { describeSchedule, formatShortDate } from './recurring-options'

/** Uma linha de um fixo cadastrado: nome, repetição, conta, próxima data e valor. Tocar edita. */
export function RecurringRow({
  item,
  category,
  accountName,
  currency,
  onEdit,
}: {
  item: Recurring
  category: Pick<Category, 'cor' | 'icone'> | undefined
  accountName: string | undefined
  currency: Currency
  onEdit: () => void
}) {
  const isCredit = item.tipo === 'receita'
  const amount = formatMoney(isCredit ? item.valor_centavos : -item.valor_centavos, currency, {
    signDisplay: 'always',
  })
  const schedule = describeSchedule(item.frequencia, item.dia, item.proxima_data)
  const next = item.ativa ? `Próximo: ${formatShortDate(item.proxima_data)}` : 'Pausado'
  const detailParts = [item.modo === 'lembrar' ? 'Só lembrar' : null, schedule, accountName].filter(
    (part): part is string => Boolean(part),
  )
  const details = detailParts.join(' · ')
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`${item.descricao}: ${amount}, ${details}. ${next}. Editar`}
      className="flex min-h-16 w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none"
    >
      <CategoryBadge cor={category?.cor ?? 'slate'} icone={category?.icone ?? 'tag'} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{item.descricao}</span>
        {/* Quebra só entre as partes ("Todo dia 5 · Nubank conta"), nunca no meio de uma */}
        <span className="block text-xs text-muted-foreground">
          {detailParts.map((part, index) => (
            <span key={part}>
              {index > 0 && ' · '}
              <span className="whitespace-nowrap">{part}</span>
            </span>
          ))}
        </span>
        <span
          className={
            item.ativa
              ? 'block text-xs whitespace-nowrap text-muted-foreground'
              : 'block text-xs font-medium text-amber-700 dark:text-amber-400'
          }
        >
          {next}
        </span>
      </span>
      <span
        className={
          isCredit
            ? 'shrink-0 font-medium text-positive tabular-nums'
            : 'shrink-0 font-medium tabular-nums'
        }
      >
        {amount}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  )
}
