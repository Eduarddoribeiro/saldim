import { HandCoins } from 'lucide-react'
import { FormAlert } from '@/components/form/FormAlert'
import { EmptyState } from '@/components/layout/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { PrivacyToggle } from '@/components/privacy/PrivacyToggle'
import { Button } from '@/components/ui/button'
import { CategoryBadge } from '@/features/categories/CategoryBadge'
import { HeroStat } from '@/features/dashboard/BalanceHero'
import { UpcomingInvoices } from '@/features/people/UpcomingInvoices'
import { useCurrency } from '@/features/profile/hooks'
import { todayIso } from '@/lib/dates'
import { errorMessage } from '@/lib/db-errors'
import { formatMoney, type Currency } from '@/lib/money'
import { useSharedDebts } from './hooks'
import { ownerLabel, summarizeSharedDebt } from './shared-debt'
import type { SharedDebt } from './sharing-api'

const shortDate = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`

/**
 * "O que eu devo" (/o-que-devo): para quem foi convidado por alguém que lhe empresta o cartão. Só
 * leitura: quanto deve, já vencido, próximas faturas mês a mês, as compras e os pagamentos feitos.
 */
export function SharedDebtPage() {
  const debts = useSharedDebts()
  const currency = useCurrency()

  return (
    <>
      <PageHeader title="O que eu devo" description="Compras feitas no cartão de outra pessoa." />
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
        <div className="grid min-w-0 gap-6 *:min-w-0">
          {debts.data.map((debt) => (
            <DebtView key={debt.pessoaId} debt={debt} currency={currency} />
          ))}
        </div>
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

  return (
    <section aria-labelledby={headingId} className="grid min-w-0 gap-4 *:min-w-0">
      <div className="rounded-3xl bg-linear-to-b from-hero to-hero-2 px-5 pt-4 pb-5 text-hero-foreground">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={headingId} className="truncate text-sm text-hero-foreground/80">
              {total > 0 ? `Você deve a ${owner}` : `Com ${owner}`}
            </h2>
            <p className="mt-1 truncate text-4xl font-bold tracking-tight tabular-nums">
              {total > 0 ? money(total) : total < 0 ? `Crédito ${money(-total)}` : 'Em dia'}
            </p>
          </div>
          <PrivacyToggle className="-mt-1 -mr-2" />
        </div>
        {total > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-3">
            <HeroStat label="Já vencido" value={money(vencido)} />
            <HeroStat label="Nas próximas faturas" value={money(futuro)} />
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-card px-4 pb-4">
        <UpcomingInvoices
          personId={debt.pessoaId}
          vencido={vencido}
          futuro={futuro}
          movements={debt.movimentos}
          purchases={debt.compras}
          invoices={debt.faturas}
          accounts={debt.cartoes}
          categories={debt.categorias}
          currency={currency}
        />
        {futuro === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            Nenhuma parcela nas próximas faturas.
          </p>
        )}
      </div>

      {debt.compras.length > 0 && (
        <section aria-labelledby={`${headingId}-compras`} className="grid gap-2">
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
                    <span className="block truncate text-xs text-muted-foreground">
                      {shortDate(purchase.data_compra)} · {cardName(purchase.account_id)} ·{' '}
                      {purchase.parcelas > 1 ? `${purchase.parcelas}×` : 'à vista'}
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
        <section aria-labelledby={`${headingId}-pagamentos`} className="grid gap-2">
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
                  <span className="block text-xs text-muted-foreground">
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
