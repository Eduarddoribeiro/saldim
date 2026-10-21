import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Account } from '@/features/accounts/accounts-api'
import type { CardPurchase } from '@/features/card-purchases/purchases-api'
import type { Category } from '@/features/categories/categories-api'
import { formatMonth, todayIso, type IsoDate, type MonthKey } from '@/lib/dates'
import { formatMoney, type Currency } from '@/lib/money'
import {
  groupUpcoming,
  upcomingByMonth,
  type UpcomingItem,
  type UpcomingMonth,
  type UpcomingSource,
} from './receivable-details'

/** Parcela ou estorno de qualquer pessoa: o componente fica só com os da pessoa do cartão. */
export type PersonMovement = UpcomingSource & { pessoa_id: string | null }

/** 'novembro' no ano corrente, 'janeiro de 2027' noutro ano (com maiúscula pelo CSS). */
function monthLabel(month: MonthKey, today: IsoDate): string {
  const label = formatMonth(month)
  return month.slice(0, 4) === today.slice(0, 4) ? label.replace(/ de \d{4}$/, '') : label
}

const dayMonth = (date: IsoDate) => `${date.slice(8, 10)}/${date.slice(5, 7)}`

/**
 * Próximas faturas de uma pessoa (docs/features/proximas-faturas.md): quanto precisa de pagar para
 * ficar em dia até ao fim do próximo mês, e o que deve em cada um dos 3 meses seguintes (o resto numa
 * linha). Cada mês abre com as compras por cartão.
 */
export function UpcomingInvoices({
  personId,
  vencido,
  futuro,
  movements,
  purchases,
  invoices,
  accounts,
  categories,
  currency,
}: {
  personId: string
  /** "Já vencido" da pessoa (receivables) */
  vencido: number
  /** "Em faturas futuras" da pessoa (total − vencido) */
  futuro: number
  movements: PersonMovement[]
  purchases: CardPurchase[]
  invoices: { id: string; data_vencimento: IsoDate }[]
  accounts: Account[]
  categories: Category[]
  currency: Currency
}) {
  const today = todayIso()
  const months = upcomingByMonth(
    movements.filter((movement) => movement.pessoa_id === personId),
    purchases,
    invoices,
    today,
    futuro,
  )
  if (months.length === 0) return null

  const { shown, rest } = groupUpcoming(months)
  const money = (cents: number) => formatMoney(cents, currency)
  const next = shown[0]
  const headingId = `proximas-${personId}`

  return (
    <section aria-labelledby={headingId} className="mt-3 grid min-w-0 gap-2 *:min-w-0">
      <p className="text-sm">
        Para ficar em dia até {dayMonth(next.ultimoVencimento)}:{' '}
        <span className="font-semibold tabular-nums">
          {money(Math.max(vencido, 0) + next.total)}
        </span>
      </p>
      <h3 id={headingId} className="text-sm font-medium text-muted-foreground">
        Próximas faturas
      </h3>
      <ul className="divide-y rounded-lg border text-sm">
        {shown.map((month) => (
          <li key={month.month}>
            <MonthDetails label={monthLabel(month.month, today)} total={money(month.total)}>
              <ItemsByCard
                items={month.items}
                purchases={purchases}
                accounts={accounts}
                categories={categories}
                money={money}
              />
            </MonthDetails>
          </li>
        ))}
        {rest && (
          <li>
            <MonthDetails
              label={`${monthLabel(rest.from, today)} a ${formatMonth(rest.to)}`}
              total={money(rest.total)}
            >
              <RestMonths months={rest.months} today={today} money={money} />
            </MonthDetails>
          </li>
        )}
      </ul>
    </section>
  )
}

/** Linha de um mês que abre (details/summary: teclado e leitor de ecrã sem JavaScript). */
function MonthDetails({
  label,
  total,
  children,
}: {
  label: string
  total: string
  children: ReactNode
}) {
  return (
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 select-none hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate first-letter:uppercase">{label}</span>
        <span className="shrink-0 font-medium tabular-nums">{total}</span>
      </summary>
      <div className="grid gap-3 px-3 pt-1 pb-3 *:min-w-0">{children}</div>
    </details>
  )
}

/** As compras de um mês, separadas por cartão (pela ordem em que aparecem). */
function ItemsByCard({
  items,
  purchases,
  accounts,
  categories,
  money,
}: {
  items: UpcomingItem[]
  purchases: CardPurchase[]
  accounts: Account[]
  categories: Category[]
  money: (cents: number) => string
}) {
  const byCard = new Map<string, UpcomingItem[]>()
  for (const item of items) byCard.set(item.cardId, [...(byCard.get(item.cardId) ?? []), item])
  const purchase = (id: string | null) => purchases.find((row) => row.id === id)

  return [...byCard].map(([cardId, cardItems]) => {
    const cardName = accounts.find((account) => account.id === cardId)?.nome ?? 'Cartão'
    return (
      <div key={cardId} className="grid gap-1 *:min-w-0">
        <p className="flex justify-between gap-3 text-xs font-medium text-muted-foreground">
          <span className="min-w-0 truncate">{cardName}</span>
          <span className="shrink-0 tabular-nums">
            {money(cardItems.reduce((sum, item) => sum + item.valor, 0))}
          </span>
        </p>
        <ul aria-label={`Compras no ${cardName}`} className="grid gap-1 *:min-w-0">
          {cardItems.map((item, index) => {
            const compra = purchase(item.compraId)
            const name =
              compra?.descricao ||
              categories.find((category) => category.id === compra?.category_id)?.nome ||
              'Compra no cartão'
            const detail =
              item.parcela === null
                ? 'estorno'
                : compra && compra.parcelas > 1
                  ? `parcela ${item.parcela}/${compra.parcelas}`
                  : 'à vista'
            return (
              <li
                key={`${item.compraId}-${item.parcela ?? 'e'}-${index}`}
                className="flex items-baseline justify-between gap-3"
              >
                <span className="min-w-0">
                  <span className="block truncate">{name}</span>
                  <span className="block text-xs text-muted-foreground">{detail}</span>
                </span>
                <span className="shrink-0 tabular-nums">{money(item.valor)}</span>
              </li>
            )
          })}
        </ul>
      </div>
    )
  })
}

/** No grupo "depois", um valor por mês (as compras de cada mês ficam por abrir aqui). */
function RestMonths({
  months,
  today,
  money,
}: {
  months: UpcomingMonth[]
  today: IsoDate
  money: (cents: number) => string
}) {
  return (
    <ul className="grid gap-1">
      {months.map((month) => (
        <li key={month.month} className="flex justify-between gap-3">
          <span className="first-letter:uppercase">{monthLabel(month.month, today)}</span>
          <span className="tabular-nums">{money(month.total)}</span>
        </li>
      ))}
    </ul>
  )
}
