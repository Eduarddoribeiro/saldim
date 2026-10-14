import { ChevronRight } from 'lucide-react'
import type { Account } from '@/features/accounts/accounts-api'
import type { Category } from '@/features/categories/categories-api'
import { CategoryBadge } from '@/features/categories/CategoryBadge'
import { formatMoney, type Currency } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { Transaction } from './transactions-api'

/** Linha de uma transação: categoria, descrição, conta e valor com sinal (+ receita, − despesa). */
export function TransactionRow({
  transaction,
  category,
  account,
  currency,
  onSelect,
}: {
  transaction: Transaction
  category: Category | undefined
  account: Account | undefined
  currency: Currency
  onSelect?: () => void
}) {
  const isIncome = transaction.tipo === 'receita'
  const categoryName = category?.nome ?? 'Sem categoria'
  const title = transaction.descricao || categoryName
  const subtitle = [transaction.descricao ? categoryName : null, account?.nome]
    .filter(Boolean)
    .join(' · ')
  // Valor guardado sempre positivo; o sinal só aparece na apresentação
  const signed = isIncome ? transaction.valor_centavos : -transaction.valor_centavos
  const amount = formatMoney(signed, currency, { signDisplay: 'always' })

  const content = (
    <>
      <CategoryBadge cor={category?.cor ?? 'slate'} icone={category?.icone ?? 'tag'} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        {subtitle && (
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        )}
      </span>
      <span
        className={cn(
          'shrink-0 text-right font-medium tabular-nums',
          isIncome ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground',
        )}
      >
        <span className="sr-only">{isIncome ? 'Receita de ' : 'Despesa de '}</span>
        {amount}
      </span>
    </>
  )

  if (!onSelect) {
    return <div className="flex min-h-16 items-center gap-3 px-3">{content}</div>
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      // Nome explícito e bem pontuado para leitores de ecrã (texto sr-only solto fica colado ao resto)
      aria-label={`${title}: ${isIncome ? 'receita' : 'despesa'} de ${formatMoney(transaction.valor_centavos, currency)}${subtitle ? `, ${subtitle}` : ''}. Editar`}
      className="flex min-h-16 w-full items-center gap-3 px-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none"
    >
      {content}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  )
}
