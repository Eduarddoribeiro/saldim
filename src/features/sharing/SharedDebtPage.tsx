import { Check, Copy, HandCoins } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { FormAlert } from '@/components/form/FormAlert'
import { EmptyState } from '@/components/layout/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { PrivacyToggle } from '@/components/privacy/PrivacyToggle'
import { Button } from '@/components/ui/button'
import { SignOutButton } from '@/features/auth/SignOutButton'
import { CategoryBadge } from '@/features/categories/CategoryBadge'
import { colorOf } from '@/features/categories/category-options'
import { groupUpcoming, upcomingByMonth } from '@/features/people/receivable-details'
import { useCurrency } from '@/features/profile/hooks'
import { formatMonth, todayIso, type IsoDate, type MonthKey } from '@/lib/dates'
import { errorMessage } from '@/lib/db-errors'
import { formatMoney, type Currency } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useSharedDebts } from './hooks'
import { ownerLabel, sharedSpendingByCategory, summarizeSharedDebt } from './shared-debt'
import type { SharedDebt } from './sharing-api'
import { chooseFullApp, useViewerOnly } from './use-viewer-only'

const shortDate = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`
const dayMonth = (date: IsoDate) => `${date.slice(8, 10)}/${date.slice(5, 7)}`
const percent = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 }).format(value)

/** 'Dezembro' no ano corrente, 'Janeiro de 2027' noutro ano. */
function monthLabel(month: MonthKey, today: IsoDate): string {
  const label = formatMonth(month)
  const short = month.slice(0, 4) === today.slice(0, 4) ? label.replace(/ de \d{4}$/, '') : label
  return short.charAt(0).toUpperCase() + short.slice(1)
}

/**
 * "O que eu devo" (/o-que-devo): para quem foi convidado por alguém que lhe empresta o cartão. Só
 * leitura e simples (pedido de 2026-11-25): quanto pagar e até quando (com a chave Pix para copiar),
 * o que deve mês a mês, onde gastou, as compras e o que já pagou. Para quem só usa o Saldim para
 * isto, é a app inteira (sem barra de navegação).
 */
export function SharedDebtPage() {
  const debts = useSharedDebts()
  const currency = useCurrency()
  const viewerOnly = useViewerOnly()
  const navigate = useNavigate()
  const single = debts.data?.length === 1 ? debts.data[0] : null

  return (
    <>
      <PageHeader
        title="O que eu devo"
        description={
          single
            ? `Suas compras no cartão de ${ownerLabel(single)}.`
            : 'Compras feitas no cartão de outra pessoa.'
        }
      />
      {debts.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando…
        </p>
      ) : debts.error ? (
        <div className="grid gap-3">
          <FormAlert>{errorMessage(debts.error)}</FormAlert>
          <Button variant="outline" className="w-fit" onClick={() => void debts.refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : debts.data.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="Nada por aqui"
          description="Quando alguém te enviar um convite do Saldim, o que você deve aparece aqui."
        />
      ) : (
        <div className="grid min-w-0 gap-8 *:min-w-0">
          {debts.data.map((debt) => (
            <DebtView key={debt.pessoaId} debt={debt} currency={currency} />
          ))}
        </div>
      )}

      {viewerOnly && (
        <footer className="mt-10 grid gap-3 border-t pt-5 text-sm text-muted-foreground">
          <p>
            Quer usar o Saldim também para as suas contas?{' '}
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => {
                chooseFullApp()
                navigate('/')
              }}
            >
              Abrir o app completo
            </button>
          </p>
          <SignOutButton className="-ml-2.5 w-fit" />
        </footer>
      )}
    </>
  )
}

function DebtView({ debt, currency }: { debt: SharedDebt; currency: Currency }) {
  const today = todayIso()
  const { total, vencido, futuro } = summarizeSharedDebt(debt, today)
  const money = (cents: number) => formatMoney(cents, currency)
  const owner = ownerLabel(debt)
  const cardName = (id: string) => debt.cartoes.find((card) => card.id === id)?.nome ?? 'Cartão'
  const category = (id: string) => debt.categorias.find((item) => item.id === id)
  const headingId = `devo-${debt.pessoaId}`

  const months = upcomingByMonth(debt.movimentos, debt.compras, debt.faturas, today, futuro)
  const { shown, rest } = groupUpcoming(months, 5)
  const next = months[0]
  const payNow = Math.max(vencido, 0) + (next?.total ?? 0)
  const spending = sharedSpendingByCategory(debt)
  const maxMonth = Math.max(vencido, ...shown.map((month) => month.total), rest?.total ?? 0, 1)

  return (
    <section aria-labelledby={headingId} className="grid min-w-0 gap-5 *:min-w-0">
      {/* Um número só: quanto pagar e até quando */}
      <div className="rounded-3xl bg-linear-to-b from-hero to-hero-2 px-5 pt-4 pb-5 text-hero-foreground">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={headingId} className="truncate text-sm text-hero-foreground/80">
              {total > 0 ? `Você deve a ${owner}` : `Com ${owner}`}
            </h2>
            {total > 0 && payNow > 0 ? (
              <>
                <p className="mt-2 text-sm text-hero-foreground/80">
                  {next ? `Para pagar até ${dayMonth(next.ultimoVencimento)}` : 'Para pagar agora'}
                </p>
                <p className="truncate text-4xl font-bold tracking-tight tabular-nums">
                  {money(payNow)}
                </p>
                {next && vencido > 0 && (
                  <p className="mt-1 text-sm text-hero-foreground/80 tabular-nums">
                    {money(next.total)} deste mês + {money(vencido)} que ficou atrasado
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1 truncate text-4xl font-bold tracking-tight tabular-nums">
                {total < 0 ? `Crédito ${money(-total)}` : 'Em dia'}
              </p>
            )}
          </div>
          <PrivacyToggle className="-mt-1 -mr-2" />
        </div>
        {total > 0 && (
          <div className="mt-4 grid gap-3 border-t border-white/15 pt-3">
            <p className="text-sm text-hero-foreground/80">
              Falta ao todo: <b className="text-hero-foreground tabular-nums">{money(total)}</b>
            </p>
            {debt.donoChavePix && <PixKey owner={owner} pixKey={debt.donoChavePix} />}
          </div>
        )}
      </div>

      {(shown.length > 0 || vencido > 0) && (
        <section
          aria-labelledby={`${headingId}-meses`}
          className="grid min-w-0 gap-3 rounded-2xl border bg-card p-4 *:min-w-0"
        >
          <h3 id={`${headingId}-meses`} className="font-semibold">
            Mês a mês
          </h3>
          <ul aria-label="Mês a mês" className="grid gap-3">
            {vencido > 0 && (
              <MonthBar label="Atrasado" value={vencido} max={maxMonth} money={money} late />
            )}
            {shown.map((month) => (
              <MonthBar
                key={month.month}
                label={monthLabel(month.month, today)}
                value={month.total}
                max={maxMonth}
                money={money}
              />
            ))}
            {rest && (
              <MonthBar
                label={`${monthLabel(rest.from, today)} a ${monthLabel(rest.to, today).toLowerCase()}`}
                value={rest.total}
                max={maxMonth}
                money={money}
              />
            )}
          </ul>
          {months.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Depois de {monthLabel(months[months.length - 1].month, today).toLowerCase()}, não fica
              mais nada.
            </p>
          )}
        </section>
      )}

      {spending.length > 0 && (
        <section
          aria-labelledby={`${headingId}-onde`}
          className="grid min-w-0 gap-3 rounded-2xl border bg-card p-4 *:min-w-0"
        >
          <h3 id={`${headingId}-onde`} className="font-semibold">
            Onde você gastou
          </h3>
          <ul aria-label="Onde você gastou" className="grid gap-3">
            {spending.map((row) => {
              const cat = category(row.categoryId)
              return (
                <li
                  key={row.categoryId}
                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1"
                >
                  <CategoryBadge size="sm" cor={cat?.cor ?? 'slate'} icone={cat?.icone ?? 'tag'} />
                  <div className="grid min-w-0 gap-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate font-medium">{cat?.nome ?? 'Outros'}</span>
                      <span className="shrink-0 tabular-nums">
                        <span className="font-semibold">{money(row.total)}</span>
                        <span className="text-sm text-muted-foreground">
                          {' '}
                          · {percent(row.share)}
                        </span>
                      </span>
                    </div>
                    <div aria-hidden className="h-2 rounded-full bg-muted">
                      <div
                        className={cn('h-full rounded-full', colorOf(cat?.cor ?? 'slate').swatch)}
                        style={{ width: `${Math.max(2, row.share * 100)}%` }}
                      />
                    </div>
                    {row.nomes.length > 0 && (
                      <span className="truncate text-sm text-muted-foreground">
                        {row.nomes.join(', ')}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {debt.compras.length > 0 && (
        <section aria-labelledby={`${headingId}-compras`} className="grid min-w-0 gap-2 *:min-w-0">
          <h3
            id={`${headingId}-compras`}
            className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
          >
            Suas compras ({debt.compras.length})
          </h3>
          <ul className="divide-y rounded-2xl border bg-card">
            {[...debt.compras].reverse().map((purchase) => {
              const cat = category(purchase.category_id)
              return (
                <li key={purchase.id} className="flex min-h-16 items-center gap-3 px-4 py-2.5">
                  <CategoryBadge cor={cat?.cor ?? 'slate'} icone={cat?.icone ?? 'tag'} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {purchase.descricao || cat?.nome || 'Compra no cartão'}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {shortDate(purchase.data_compra)} · {cardName(purchase.account_id)} ·{' '}
                      {purchase.parcelas > 1 ? `em ${purchase.parcelas} vezes` : 'à vista'}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {money(purchase.valor_total_centavos)}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {debt.reembolsos.length > 0 && (
        <section
          aria-labelledby={`${headingId}-pagamentos`}
          className="grid min-w-0 gap-2 *:min-w-0"
        >
          <h3
            id={`${headingId}-pagamentos`}
            className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
          >
            O que você já pagou
          </h3>
          <ul className="divide-y rounded-2xl border bg-card">
            {[...debt.reembolsos].reverse().map((item) => (
              <li key={item.id} className="flex min-h-14 items-center justify-between gap-3 px-4">
                <span className="min-w-0">
                  <span className="block truncate">{item.descricao || 'Pagamento'}</span>
                  <span className="block text-sm text-muted-foreground">
                    {shortDate(item.data)}
                  </span>
                </span>
                <span className="shrink-0 font-medium text-positive tabular-nums">
                  {money(item.valor_centavos)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {debt.dividaAnterior > 0 && (
        <p className="text-sm text-muted-foreground">
          Inclui uma dívida anterior de{' '}
          <span className="tabular-nums">{money(debt.dividaAnterior)}</span>.
        </p>
      )}
    </section>
  )
}

function MonthBar({
  label,
  value,
  max,
  money,
  late = false,
}: {
  label: string
  value: number
  max: number
  money: (cents: number) => string
  late?: boolean
}) {
  return (
    <li className="grid grid-cols-[auto_minmax(3rem,1fr)_auto] items-center gap-3">
      <span className={cn('whitespace-nowrap', late && 'font-medium text-destructive')}>
        {label}
      </span>
      <span aria-hidden className="h-2.5 rounded-full bg-muted">
        <span
          className={cn('block h-full rounded-full', late ? 'bg-destructive' : 'bg-primary')}
          style={{ width: `${Math.max(3, (value * 100) / max)}%` }}
        />
      </span>
      <span className="font-semibold tabular-nums">{money(value)}</span>
    </li>
  )
}

/** A chave Pix de quem convidou, com um botão para copiar (e o texto à vista, se copiar falhar). */
function PixKey({ owner, pixKey }: { owner: string; pixKey: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="grid gap-2">
      <Button
        type="button"
        size="lg"
        className="h-12 rounded-full bg-hero-foreground text-base text-hero hover:bg-hero-foreground/90"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(pixKey)
            setCopied(true)
          } catch {
            setCopied(false)
          }
        }}
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        {copied ? 'Chave copiada' : `Copiar chave Pix de ${owner}`}
      </Button>
      <p className="text-center text-xs text-hero-foreground/80 select-all">Chave: {pixKey}</p>
    </div>
  )
}
