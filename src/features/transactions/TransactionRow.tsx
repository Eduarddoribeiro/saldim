import { ChevronRight } from 'lucide-react'
import type { Account } from '@/features/accounts/accounts-api'
import type { Category } from '@/features/categories/categories-api'
import { CategoryBadge } from '@/features/categories/CategoryBadge'
import { formatMoney, type Currency } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { Transaction } from './transactions-api'

/** Como se lê cada tipo (nome acessível e texto escondido antes do valor). */
const TIPO_LABELS: Record<Transaction['tipo'], string> = {
  receita: 'receita',
  despesa: 'despesa',
  estorno: 'estorno',
}

/**
 * Linha de uma transação: categoria, descrição, conta e valor com sinal (+ receita ou estorno,
 * − despesa). Uma parcela de uma compra no cartão mostra também "Parcela k/n"; um estorno, "Estorno";
 * um lançamento criado por uma recorrência (R1), "Recorrente"; uma compra de outra pessoa (T1),
 * "Para <nome>" (não conta nos gastos de quem usa a app).
 */
export function TransactionRow({
  transaction,
  category,
  account,
  currency,
  totalParcelas,
  personName,
  onSelect,
}: {
  transaction: Transaction
  category: Category | undefined
  account: Account | undefined
  currency: Currency
  /** Número total de parcelas da compra (só para parcelas) */
  totalParcelas?: number
  /** Nome da pessoa a quem pertence a compra (T1), se não for de quem usa a app */
  personName?: string
  onSelect?: () => void
}) {
  // Receitas e estornos são créditos (+); despesas e parcelas, débitos (−)
  const isCredit = transaction.tipo !== 'despesa'
  const tipoLabel = TIPO_LABELS[transaction.tipo]
  const categoryName = category?.nome ?? 'Sem categoria'
  const title = transaction.descricao || categoryName
  const cardItem =
    transaction.tipo === 'estorno'
      ? 'Estorno'
      : transaction.parcela_numero !== null && !transaction.recorrencia_id
        ? `Parcela ${transaction.parcela_numero}/${totalParcelas ?? '?'}`
        : null
  // Uma compra à vista criada por uma recorrência mostra só "Recorrente" (não "Parcela 1/1")
  const recurringItem = transaction.recorrencia_id ? 'Recorrente' : null
  // "Estorno"/"Parcela k/n"/"Recorrente" primeiro: no telemóvel o fim da linha é cortado
  const personItem = transaction.pessoa_id ? `Para ${personName ?? 'outra pessoa'}` : null
  const subtitle = [
    personItem,
    cardItem,
    recurringItem,
    transaction.descricao ? categoryName : null,
    account?.nome,
  ]
    .filter(Boolean)
    .join(' · ')
  // Valor guardado sempre positivo; o sinal só aparece na apresentação
  const signed = isCredit ? transaction.valor_centavos : -transaction.valor_centavos
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
          isCredit ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground',
        )}
      >
        <span className="sr-only">
          {tipoLabel.charAt(0).toUpperCase() + tipoLabel.slice(1)} de{' '}
        </span>
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
      aria-label={`${title}: ${tipoLabel} de ${formatMoney(transaction.valor_centavos, currency)}${subtitle ? `, ${subtitle}` : ''}. ${transaction.compra_id ? 'Ver compra' : 'Editar'}`}
      className="flex min-h-16 w-full items-center gap-3 px-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none"
    >
      {content}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  )
}
