import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatMonth, todayIso, type IsoDate, type MonthKey } from '@/lib/dates'
import { formatMoney, type Currency } from '@/lib/money'
import { cn } from '@/lib/utils'
import { dotClasses } from './bank-colors'
import { dayMonth } from './invoice-options'
import type { UpcomingCardMonth } from './upcoming-months'

type Item = {
  pessoa_id: string | null
  valor_centavos: number
  tipo: string
  compra_id: string | null
  parcela_numero: number | null
  descricao: string
  category_id: string
}

/** 'dezembro' no ano corrente, 'janeiro de 2027' noutro (com maiúscula pelo CSS). */
function monthLabel(month: MonthKey, today: IsoDate): string {
  const label = formatMonth(month)
  return month.slice(0, 4) === today.slice(0, 4) ? label.replace(/ de \d{4}$/, '') : label
}

/** Quantos meses aparecem um a um; os seguintes somam-se numa linha. */
const SHOWN = 3

/**
 * Próximas faturas de todos os cartões juntos (em Cartões): em cada mês que vem, quanto vai sair e
 * quanto é seu e de cada pessoa. Cada mês abre com as compras por cartão.
 */
export function UpcomingCardInvoices({
  months,
  cardName,
  personName,
  categoryName,
  totalParcelas,
  currency,
}: {
  months: UpcomingCardMonth<Item>[]
  cardName: (id: string) => string
  personName: (id: string) => string
  categoryName: (id: string) => string
  totalParcelas: (compraId: string) => number | undefined
  currency: Currency
}) {
  if (months.length === 0) return null
  const today = todayIso()
  const money = (cents: number) => formatMoney(cents, currency)
  const split = (month: { meu: number; pessoas: { pessoaId: string; centavos: number }[] }) =>
    [
      month.meu !== 0 ? `Seu ${money(month.meu)}` : null,
      ...month.pessoas.map((person) => `${personName(person.pessoaId)} ${money(person.centavos)}`),
    ]
      .filter(Boolean)
      .join(' · ')
  const shown = months.slice(0, SHOWN)
  const rest = months.slice(SHOWN)
  const restTotals = {
    total: rest.reduce((sum, month) => sum + month.total, 0),
    meu: rest.reduce((sum, month) => sum + month.meu, 0),
    pessoas: [...new Set(rest.flatMap((month) => month.pessoas.map((p) => p.pessoaId)))].map(
      (pessoaId) => ({
        pessoaId,
        centavos: rest.reduce(
          (sum, month) => sum + (month.pessoas.find((p) => p.pessoaId === pessoaId)?.centavos ?? 0),
          0,
        ),
      }),
    ),
  }

  return (
    <section aria-labelledby="proximas-faturas" className="mb-6 grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="proximas-faturas"
          className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          Próximas faturas
        </h2>
        <span className="text-xs text-muted-foreground">Todos os cartões</span>
      </div>
      <ul className="divide-y rounded-2xl border bg-card text-sm">
        {shown.map((month) => (
          <li key={month.month}>
            <MonthRow
              label={monthLabel(month.month, today)}
              hint={`vence até ${dayMonth(month.ultimoVencimento)}`}
              total={money(month.total)}
              split={split(month)}
            >
              {month.cartoes.map((card) => (
                <div key={card.cardId} className="grid gap-1 *:min-w-0">
                  <p className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        aria-hidden
                        className={cn(
                          'size-2 shrink-0 rounded-full',
                          dotClasses(cardName(card.cardId)),
                        )}
                      />
                      <span className="truncate">{cardName(card.cardId)}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">{money(card.total)}</span>
                  </p>
                  <ul aria-label={`Compras no ${cardName(card.cardId)}`} className="grid gap-1">
                    {card.items.map((item, index) => {
                      const estorno = item.tipo === 'estorno'
                      const n = item.compra_id ? totalParcelas(item.compra_id) : undefined
                      const detail = [
                        estorno
                          ? 'estorno'
                          : n && n > 1 && item.parcela_numero
                            ? `parcela ${item.parcela_numero}/${n}`
                            : 'à vista',
                        item.pessoa_id ? `para ${personName(item.pessoa_id)}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                      return (
                        <li
                          key={`${item.compra_id}-${item.parcela_numero}-${index}`}
                          className="flex items-baseline justify-between gap-3"
                        >
                          <span className="min-w-0">
                            <span className="block truncate">
                              {item.descricao || categoryName(item.category_id)}
                            </span>
                            <span className="block text-xs text-muted-foreground">{detail}</span>
                          </span>
                          <span className="shrink-0 tabular-nums">
                            {money(estorno ? -item.valor_centavos : item.valor_centavos)}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </MonthRow>
          </li>
        ))}
        {rest.length > 0 && (
          <li>
            <MonthRow
              label={`${monthLabel(rest[0].month, today)} a ${formatMonth(rest[rest.length - 1].month)}`}
              total={money(restTotals.total)}
              split={split(restTotals)}
            >
              <ul className="grid gap-1">
                {rest.map((month) => (
                  <li key={month.month} className="flex justify-between gap-3">
                    <span className="first-letter:uppercase">{monthLabel(month.month, today)}</span>
                    <span className="tabular-nums">{money(month.total)}</span>
                  </li>
                ))}
              </ul>
            </MonthRow>
          </li>
        )}
      </ul>
    </section>
  )
}

/** Linha de um mês que abre (details/summary: teclado e leitor de ecrã sem JavaScript). */
function MonthRow({
  label,
  hint,
  total,
  split,
  children,
}: {
  label: string
  hint?: string
  total: string
  split: string
  children: ReactNode
}) {
  return (
    <details className="group">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-3 py-2 select-none hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium first-letter:uppercase">
            {label}
            {hint && <span className="font-normal text-muted-foreground"> · {hint}</span>}
          </span>
          {split && (
            <span className="block truncate text-xs text-muted-foreground tabular-nums">
              {split}
            </span>
          )}
        </span>
        <span className="shrink-0 font-semibold tabular-nums">{total}</span>
      </summary>
      <div className="grid gap-3 px-3 pt-1 pb-3 *:min-w-0">{children}</div>
    </details>
  )
}
