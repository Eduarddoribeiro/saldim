import { PiggyBank } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { FormAlert } from '@/components/form/FormAlert'
import { PageHeader } from '@/components/layout/PageHeader'
import { useAccounts } from '@/features/accounts/hooks'
import { useCurrency } from '@/features/profile/hooks'
import { useRepeatingExpenses } from '@/features/repeating/hooks'
import { useBalanceMovements } from '@/features/transactions/hooks'
import { useTransfers } from '@/features/transfers/hooks'
import { todayIso } from '@/lib/dates'
import { errorMessage } from '@/lib/db-errors'
import { balancesByAccount, transferMovements } from '@/lib/finance'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { CDI, RATES_DATE, SELIC } from './rates'
import { ReserveCard } from './ReserveCard'
import { averageMonthlySpending } from './reserve'
import { DEFAULT_SHARE, monthlyDeposit, savingsOptions } from './simulate'

const PERIODS = [
  { months: 12, label: '1 ano' },
  { months: 24, label: '2 anos' },
  { months: 60, label: '5 anos' },
]
const rate = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 2 }).format(value)

/** Contas onde o dinheiro guardado costuma estar */
const SAVINGS_TYPES = new Set(['poupanca', 'investimento'])

/**
 * Guardar dinheiro (/guardar, pedido de 2026-11-25): do que sobra dos fixos, quanto guardar por mês,
 * a reserva de emergência (3 meses de gastos) e quanto rende em cada aplicação. É uma simulação: a
 * app não investe nada.
 */
export function SavingsPage() {
  const repeating = useRepeatingExpenses()
  const movements = useBalanceMovements()
  const accounts = useAccounts()
  const transfers = useTransfers()
  const currency = useCurrency()
  const [share, setShare] = useState(DEFAULT_SHARE)
  const [months, setMonths] = useState(12)
  const money = (cents: number) => formatMoney(cents, currency)

  const header = (
    <PageHeader
      title="Guardar dinheiro"
      description="Quanto dá para guardar do que sobra dos seus fixos, e quanto isso rende."
    />
  )
  const queries = [repeating, movements, accounts, transfers]
  if (queries.some((query) => query.isPending)) {
    return (
      <>
        {header}
        <p role="status" className="text-sm text-muted-foreground">
          Carregando…
        </p>
      </>
    )
  }
  const error = queries.find((query) => query.error)?.error
  if (error || !repeating.data) {
    return (
      <>
        {header}
        <FormAlert>{errorMessage(error)}</FormAlert>
      </>
    )
  }

  const today = todayIso()
  const { rendaFixa, totalMensal } = repeating.data
  const sobra = rendaFixa - totalMensal
  const deposit = monthlyDeposit(sobra, share)
  const spending = averageMonthlySpending(movements.data ?? [], today)
  const allAccounts = accounts.data ?? []
  const balances = balancesByAccount(
    allAccounts,
    [...(movements.data ?? []), ...transferMovements(transfers.data ?? [])],
    { today },
  )
  const saved = allAccounts
    .filter((account) => SAVINGS_TYPES.has(account.tipo))
    .reduce((sum, account) => sum + (balances.get(account.id) ?? 0), 0)
  const options = savingsOptions(deposit, months)
  const put = deposit * months

  return (
    <>
      {header}
      <div className="grid min-w-0 gap-4 *:min-w-0">
        <section
          aria-labelledby="quanto-guardar"
          className="grid gap-3 rounded-2xl border bg-card p-4"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="quanto-guardar" className="font-semibold">
              Quanto guardar
            </h2>
            <span className="text-sm font-medium tabular-nums">
              {Math.round(share * 100)}% da sobra
            </span>
          </div>
          {rendaFixa === 0 ? (
            <div className="grid gap-2 text-sm">
              <p>
                Para calcular quanto sobra, o app precisa saber o que entra todo mês (salário,
                mesada, ajuda da família).
              </p>
              <Link
                to="/fixos"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Cadastrar uma entrada em Fixos
              </Link>
            </div>
          ) : sobra <= 0 ? (
            <FormAlert>
              Hoje os fixos ({money(totalMensal)}) usam tudo o que entra fixo ({money(rendaFixa)}).
              Antes de guardar, vale ver em Fixos o que dá para cortar.
            </FormAlert>
          ) : (
            <>
              <input
                type="range"
                min={10}
                max={60}
                step={5}
                value={Math.round(share * 100)}
                onChange={(event) => setShare(Number(event.target.value) / 100)}
                aria-label="Parte da sobra para guardar"
                aria-valuetext={`${Math.round(share * 100)}% da sobra, ${money(deposit)} por mês`}
                className="w-full accent-primary"
              />
              <dl className="grid grid-cols-3 gap-2">
                <Stat label="Sobra do mês" value={money(sobra)} />
                <Stat label="Guardar" value={money(deposit)} className="text-positive" />
                <Stat label="Para gastar" value={money(sobra - deposit)} />
              </dl>
              <p className="text-xs text-muted-foreground">
                A sobra é o que entra fixo ({money(rendaFixa)}) menos os fixos ({money(totalMensal)}
                ). Mercado, lanches e o resto do dia a dia saem do que fica para gastar, por isso a
                sugestão é começar em {Math.round(DEFAULT_SHARE * 100)}%.
              </p>
            </>
          )}
        </section>

        <ReserveCard
          spending={spending}
          saved={saved}
          deposit={deposit}
          accounts={allAccounts}
          money={money}
        />

        {deposit > 0 && (
          <section
            aria-labelledby="quanto-rende"
            className="grid gap-3 rounded-2xl border bg-card p-4"
          >
            <h2 id="quanto-rende" className="flex items-center gap-2 font-semibold">
              <PiggyBank className="size-5 text-primary" aria-hidden />
              Quanto rende
            </h2>
            <div role="group" aria-label="Prazo" className="flex flex-wrap gap-2">
              {PERIODS.map((period) => (
                <button
                  key={period.months}
                  type="button"
                  aria-pressed={months === period.months}
                  onClick={() => setMonths(period.months)}
                  className={cn(
                    'min-h-9 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                    months === period.months
                      ? 'border-transparent bg-primary text-primary-foreground'
                      : 'bg-muted/60 hover:bg-muted',
                  )}
                >
                  {period.label}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">
              Guardando {money(deposit)} por mês, você coloca {money(put)}. Ao fim do prazo teria:
            </p>
            <ul aria-label="Quanto rende em cada aplicação" className="divide-y">
              {options.map((option, index) => (
                <li key={option.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-2.5">
                  <span className="font-medium">{option.nome}</span>
                  <span
                    className={cn('font-semibold tabular-nums', index === 0 && 'text-positive')}
                  >
                    {money(option.total)}
                  </span>
                  <span className="col-span-2 text-xs text-muted-foreground">
                    Rende {money(option.rendimento)}. {option.nota}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Simulação com a Selic de {rate(SELIC)} e o CDI de {rate(CDI)} ao ano (Copom de{' '}
              {RATES_DATE.split('-').reverse().join('/')}), iguais durante todo o prazo; se os juros
              caírem, rende menos. Valores já sem imposto de renda. O app não investe nada: é só uma
              conta.
            </p>
          </section>
        )}
      </div>
    </>
  )
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('truncate font-semibold tracking-tight tabular-nums', className)}>
        {value}
      </dd>
    </div>
  )
}
