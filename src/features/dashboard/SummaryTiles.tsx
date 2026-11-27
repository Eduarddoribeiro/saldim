import { CalendarClock, CalendarRange, HandCoins, PiggyBank, Repeat } from 'lucide-react'
import { useMonthEndForecast } from '@/features/forecast/use-forecast'
import { useUpcomingCardMonths } from '@/features/invoices/use-next-invoices'
import { useCurrency } from '@/features/profile/hooks'
import { useRepeatingExpenses } from '@/features/repeating/hooks'
import { formatMonth } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { SummaryTile } from './SummaryTile'

const monthName = (month: string) => formatMonth(month).replace(/ de \d{4}$/, '')

/**
 * Os blocos do Início (pedido de 2026-11-27: "mais botão e menos rolagem"): cada um mostra só o
 * número que importa e leva ao detalhe. Fim do mês que vem, reserva, próxima fatura, mês fixo e a
 * receber.
 */
export function SummaryTiles({
  guardado,
  metaReserva,
  aReceber,
  aReceberSub,
  hasCards,
}: {
  guardado: number
  metaReserva: number
  aReceber: number
  aReceberSub: string
  hasCards: boolean
}) {
  const currency = useCurrency()
  const money = (cents: number) => formatMoney(cents, currency)
  const forecast = useMonthEndForecast(true)
  const months = useUpcomingCardMonths()
  const repeating = useRepeatingExpenses()
  const next = months?.[0]
  const sobraFixa = repeating.data ? repeating.data.rendaFixa - repeating.data.totalMensal : null
  const reserveShare = metaReserva > 0 ? Math.min(1, Math.max(0, guardado) / metaReserva) : 0

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 *:min-w-0 [&>*:last-child:nth-child(odd)]:col-span-2">
      {forecast && (
        <SummaryTile
          to="/previsao"
          icon={CalendarRange}
          label={`Fim de ${monthName(forecast.until.slice(0, 7))}`}
          value={money(Math.abs(forecast.sobra))}
          tone={forecast.sobra < 0 ? 'negative' : 'positive'}
          sub={
            forecast.sobra < 0 ? 'Vai faltar depois de pagar tudo' : 'Sobra depois de pagar tudo'
          }
          ariaLabel={`Fim de ${monthName(forecast.until.slice(0, 7))}: ${forecast.sobra < 0 ? 'vai faltar' : 'sobra'} ${money(Math.abs(forecast.sobra))}. Ver a previsão`}
        />
      )}
      <SummaryTile
        to="/guardar"
        icon={PiggyBank}
        label="Reserva"
        value={money(guardado)}
        sub={metaReserva > 0 ? `de ${money(metaReserva)}` : 'Guardar dinheiro'}
        ariaLabel={`Reserva: ${money(guardado)}${metaReserva > 0 ? ` de ${money(metaReserva)}` : ''}. Guardar dinheiro`}
      >
        {metaReserva > 0 && (
          <span aria-hidden className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-positive"
              style={{ width: `${Math.max(2, reserveShare * 100)}%` }}
            />
          </span>
        )}
      </SummaryTile>
      {hasCards && next && (
        <SummaryTile
          to="/faturas"
          icon={CalendarClock}
          label={`Faturas de ${monthName(next.month)}`}
          value={money(next.total)}
          sub={next.pessoas.length > 0 ? `Sua parte ${money(next.meu)}` : 'Todos os cartões'}
          ariaLabel={`Faturas de ${monthName(next.month)}: ${money(next.total)}. Ver os cartões`}
        />
      )}
      {sobraFixa !== null &&
        (repeating.data!.items.length > 0 || repeating.data!.income.length > 0) && (
          <SummaryTile
            to="/fixos"
            icon={Repeat}
            label="Mês fixo"
            value={money(sobraFixa)}
            tone={sobraFixa < 0 ? 'negative' : undefined}
            sub={`Entra ${money(repeating.data!.rendaFixa)} · sai ${money(repeating.data!.totalMensal)}`}
            ariaLabel={`Mês fixo: sobra ${money(sobraFixa)} por mês. Ver os fixos`}
          />
        )}
      {aReceber !== 0 && (
        <SummaryTile
          to="/a-receber"
          icon={HandCoins}
          label="A receber"
          value={money(aReceber)}
          sub={aReceberSub}
          ariaLabel={`A receber: ${money(aReceber)}. Ver quem deve`}
        />
      )}
    </div>
  )
}
