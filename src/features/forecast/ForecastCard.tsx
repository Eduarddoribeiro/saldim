import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useCurrency } from '@/features/profile/hooks'
import { formatMonth } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { ForecastKind } from './forecast'
import { useMonthEndForecast } from './use-forecast'

const dayMonth = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`

const KIND_LABEL: Record<ForecastKind, string> = {
  entrada: 'Entra',
  receber: 'Vão te pagar',
  fatura: 'Fatura',
  conta: 'Sai da conta',
}

/**
 * No Início (pedido de 2026-11-26): como fica o dinheiro no fim do mês que vem depois de pagar tudo
 * e receber o que tem para receber. Dá para tirar o que vão te pagar (e se atrasarem?) e abrir os
 * movimentos dia a dia, com o saldo depois de cada um.
 */
export function ForecastCard() {
  const [includeReceber, setIncludeReceber] = useState(true)
  const forecast = useMonthEndForecast(includeReceber)
  const currency = useCurrency()
  if (!forecast) return null
  const money = (cents: number) => formatMoney(cents, currency)
  const monthName = formatMonth(forecast.until.slice(0, 7)).replace(/ de \d{4}$/, '')
  const falta = forecast.sobra < 0
  const hasReceber = forecast.timeline.some((step) => step.kind === 'receber') || !includeReceber

  return (
    <section
      aria-labelledby="fim-do-mes"
      className="mb-4 grid min-w-0 gap-4 rounded-2xl border bg-card p-4 *:min-w-0"
    >
      <div className="grid gap-1">
        <h2 id="fim-do-mes" className="font-semibold">
          Como você fica no fim de {monthName}
        </h2>
        <p className="text-xs text-muted-foreground">
          Depois de pagar as contas e as faturas até {dayMonth(forecast.until)} e de receber o que
          está previsto.
        </p>
      </div>

      <div>
        <p className="text-xs text-muted-foreground">{falta ? 'Vai faltar' : 'Sobra'}</p>
        <p
          className={cn(
            'text-3xl font-bold tracking-tight tabular-nums',
            falta ? 'text-destructive' : 'text-positive',
          )}
        >
          {money(Math.abs(forecast.sobra))}
        </p>
      </div>

      <dl className="grid gap-1.5 text-sm">
        <Row label="Nas contas hoje" value={money(forecast.disponivel)} />
        <Row label="Vai entrar" value={`+ ${money(forecast.entradas)}`} />
        {hasReceber && (
          <Row
            label="Vão te pagar"
            value={includeReceber ? `+ ${money(forecast.receber)}` : 'fora da conta'}
          />
        )}
        <Row label="Faturas" value={`− ${money(forecast.faturas)}`} />
        <Row label="Sai da conta" value={`− ${money(forecast.conta)}`} />
      </dl>

      {hasReceber && (
        <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm">
          <span>
            <span className="block font-medium">Contar com o que vão te pagar</span>
            <span className="block text-xs text-muted-foreground">
              Desligue para ver como fica se atrasarem.
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={includeReceber}
            onChange={(event) => setIncludeReceber(event.target.checked)}
            className="size-5 shrink-0 accent-primary"
          />
        </label>
      )}

      <div className="grid gap-1 rounded-xl bg-muted/60 p-3 text-sm">
        {forecast.diaADia > 0 && (
          <p>
            Com o dia a dia (uns {money(forecast.diaADia)} de mercado, lanches…):{' '}
            <b className={cn('tabular-nums', forecast.sobraComDiaADia < 0 && 'text-destructive')}>
              {forecast.sobraComDiaADia < 0
                ? `faltam ${money(-forecast.sobraComDiaADia)}`
                : money(forecast.sobraComDiaADia)}
            </b>
          </p>
        )}
        {/* Só quando o saldo desce abaixo do que tem hoje (ou fica negativo) em algum dia */}
        {(forecast.menor.saldo < forecast.disponivel || forecast.menor.saldo < 0) && (
          <p className={cn(forecast.menor.saldo < 0 && 'text-destructive')}>
            Dia mais apertado: {dayMonth(forecast.menor.data)}, com{' '}
            <b className="tabular-nums">{money(forecast.menor.saldo)}</b>
            {forecast.menor.saldo < 0 ? ' (conta no vermelho)' : ''}.
          </p>
        )}
      </div>

      {forecast.timeline.length > 0 && (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-medium select-none [&::-webkit-details-marker]:hidden">
            <ChevronRight
              className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
              aria-hidden
            />
            Ver dia a dia ({forecast.timeline.length})
          </summary>
          <ol aria-label="Dia a dia até o fim do mês" className="mt-1 divide-y">
            {forecast.timeline.map((step, index) => (
              <li
                key={`${step.data}-${index}`}
                className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-x-3 py-2 text-sm"
              >
                <span className="text-muted-foreground tabular-nums">{dayMonth(step.data)}</span>
                <span className="min-w-0">
                  <span className="block truncate">{step.descricao}</span>
                  <span className="block text-xs text-muted-foreground">
                    {KIND_LABEL[step.kind]}
                  </span>
                </span>
                <span className="text-right tabular-nums">
                  <span className={cn('block font-medium', step.valor > 0 && 'text-positive')}>
                    {step.valor > 0 ? '+' : '−'} {money(Math.abs(step.valor))}
                  </span>
                  <span
                    className={cn(
                      'block text-xs text-muted-foreground',
                      step.saldo < 0 && 'text-destructive',
                    )}
                  >
                    fica {money(step.saldo)}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 truncate text-muted-foreground">{label}</dt>
      <dd className="shrink-0 font-medium tabular-nums">{value}</dd>
    </div>
  )
}
