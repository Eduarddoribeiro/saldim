import type { Account } from '@/features/accounts/accounts-api'
import type { Category } from '@/features/categories/categories-api'
import { CategoryBadge } from '@/features/categories/CategoryBadge'
import type { IsoDate } from '@/lib/dates'
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
  purchaseDate,
  personName,
  when,
  onSelect,
}: {
  transaction: Transaction
  category: Category | undefined
  account: Account | undefined
  currency: Currency
  /** Número total de parcelas da compra (só para parcelas) */
  totalParcelas?: number
  /** Data da compra (só parcelas): a 2/2 de 19/09 é uma compra de 19/08, não desse dia */
  purchaseDate?: IsoDate
  /** Nome da pessoa a quem pertence a compra (T1), se não for de quem usa a app */
  personName?: string
  /** Lançamento previsto (data depois de hoje): quando cai, ex. "Cai em 28/11". O valor fica apagado. */
  when?: string
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
      : // À vista (1/1) não diz "Parcela": o nome do cartão já aparece na linha
        transaction.parcela_numero !== null && !transaction.recorrencia_id && totalParcelas !== 1
        ? // A data da compra junto da parcela: a 10/12 de 28/11 não é uma compra desse dia
          `Parcela ${transaction.parcela_numero}/${totalParcelas ?? '?'}${
            purchaseDate && purchaseDate !== transaction.data
              ? `, comprado em ${purchaseDate.slice(8, 10)}/${purchaseDate.slice(5, 7)}`
              : ''
          }`
        : null
  // Uma compra à vista criada por uma recorrência mostra só "Recorrente" (não "Parcela 1/1")
  const recurringItem = transaction.recorrencia_id ? 'Recorrente' : null
  const personItem = transaction.pessoa_id ? `Para ${personName ?? 'outra pessoa'}` : null
  // Em destaque, no início: quando cai (previsto) e a parcela ou o estorno — é o que explica a linha
  const lead = [when, cardItem].filter(Boolean).join(' · ')
  const rest = [
    personItem,
    recurringItem,
    transaction.descricao ? categoryName : null,
    account?.nome,
  ]
    .filter(Boolean)
    .join(' · ')
  const subtitle = [lead, rest].filter(Boolean).join(' · ')
  // Valor guardado sempre positivo; o sinal só aparece na apresentação
  const signed = isCredit ? transaction.valor_centavos : -transaction.valor_centavos
  const amount = formatMoney(signed, currency, { signDisplay: 'always' })

  const content = (
    <>
      <CategoryBadge cor={category?.cor ?? 'slate'} icone={category?.icone ?? 'tag'} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        {subtitle && (
          <span className="line-clamp-2 text-xs text-muted-foreground">
            {lead && <span className="font-medium text-foreground/80">{lead}</span>}
            {lead && rest && ' · '}
            {rest}
          </span>
        )}
      </span>
      <span
        className={cn(
          'shrink-0 text-right font-medium tabular-nums',
          isCredit ? 'text-positive' : 'text-foreground',
          when && 'opacity-60',
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
      className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none"
    >
      {content}
    </button>
  )
}
