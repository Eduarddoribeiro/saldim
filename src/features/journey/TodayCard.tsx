import { Check, Flame, Plus, Snowflake } from 'lucide-react'
import { useState } from 'react'
import { FormAlert } from '@/components/form/FormAlert'
import { SheetContent } from '@/components/layout/SheetContent'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useCurrency } from '@/features/profile/hooks'
import { useQuickEntry } from '@/features/quick-entry/quick-entry-context'
import { addDays, type IsoDate } from '@/lib/dates'
import { errorMessage } from '@/lib/db-errors'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Celebration } from './Celebration'
import { useCloseDay } from './hooks'
import { currentStreak, daysLeftInWeek, STARS } from './journey'
import { useJourney } from './use-journey'

const weekday = (date: IsoDate, style: 'long' | 'short') => {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { weekday: style, timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)))
    .replace('.', '')
    .replace('-feira', '')
}
const dayMonth = (date: IsoDate) => `${date.slice(8, 10)}/${date.slice(5, 7)}`

/**
 * No Início (pedido de 2026-11-26): fechar o dia ("lancei tudo de hoje" ou "não gastei nada"), os
 * últimos 7 dias (fechados, folga, hoje) e o desafio da semana. Fechar celebra com a estrela ganha.
 */
export function TodayCard() {
  const journey = useJourney()
  const close = useCloseDay()
  const openEntry = useQuickEntry()
  const currency = useCurrency()
  const [celebrate, setCelebrate] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!journey.data) return null
  const { today, closed, streak, challenge, lancamentosHoje } = journey.data
  const folgas = new Set(streak.folgas)
  const last7 = Array.from({ length: 7 }, (_, index) => addDays(today, index - 6))
  const money = (cents: number) => formatMoney(cents, currency)

  const closeToday = () => {
    setError(null)
    close.mutate(today, {
      onSuccess: () => {
        const next = new Set(closed)
        next.add(today)
        setCelebrate(currentStreak(next, today).atual)
      },
      onError: (cause) => setError(errorMessage(cause)),
    })
  }

  return (
    <section
      aria-labelledby="hoje"
      className="mb-4 grid min-w-0 gap-3 rounded-2xl border bg-card p-4 *:min-w-0"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="hoje" className="font-semibold first-letter:uppercase">
          Hoje, {weekday(today, 'long')} {dayMonth(today)}
        </h2>
        <span className="text-xs text-muted-foreground">
          {lancamentosHoje === 1 ? '1 lançamento' : `${lancamentosHoje} lançamentos`}
        </span>
      </div>

      <ol aria-label="Últimos 7 dias" className="grid grid-cols-7 gap-1 text-center">
        {last7.map((day) => {
          const isClosed = closed.has(day)
          const isFree = folgas.has(day)
          const label = isClosed ? 'fechado' : isFree ? 'folga' : day === today ? 'hoje' : 'aberto'
          return (
            <li
              key={day}
              aria-label={`${weekday(day, 'long')} ${dayMonth(day)}: ${label}`}
              className="grid justify-items-center gap-1"
            >
              <span
                aria-hidden
                className={cn(
                  'flex size-8 items-center justify-center rounded-full bg-muted',
                  isClosed && 'bg-orange-500/15 text-orange-500 dark:text-orange-300',
                  isFree && 'bg-primary/15 text-primary',
                  day === today &&
                    !isClosed &&
                    'ring-2 ring-orange-400 ring-offset-2 ring-offset-card',
                )}
              >
                {isClosed ? (
                  <Flame className="size-4" />
                ) : isFree ? (
                  <Snowflake className="size-4" />
                ) : null}
              </span>
              <span aria-hidden className="text-[11px] text-muted-foreground">
                {weekday(day, 'short').slice(0, 3)}
              </span>
            </li>
          )
        })}
      </ol>

      {error && <FormAlert>{error}</FormAlert>}
      {streak.hojeFechado ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Check className="size-4 text-positive" aria-hidden />
          Dia fechado · {streak.atual} {streak.atual === 1 ? 'dia seguido' : 'dias seguidos'}. Volte
          amanhã.
        </p>
      ) : lancamentosHoje > 0 ? (
        <Button
          size="lg"
          className="h-11 rounded-full"
          disabled={close.isPending}
          onClick={closeToday}
        >
          <Check aria-hidden />
          Lancei tudo de hoje · +{STARS.dia}
        </Button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="lg"
            variant="outline"
            className="h-11 rounded-full"
            onClick={() => openEntry()}
          >
            <Plus aria-hidden />
            Lançar algo
          </Button>
          <Button
            size="lg"
            className="h-11 rounded-full"
            disabled={close.isPending}
            onClick={closeToday}
          >
            Não gastei nada
          </Button>
        </div>
      )}
      {streak.folgas.some((day) => day >= last7[0]) && (
        <p className="text-xs text-muted-foreground">
          Um dia esquecido nesta semana virou folga: a sequência continua.
        </p>
      )}

      {challenge.limite > 0 && (
        <div className="grid gap-1.5 rounded-xl bg-muted/60 p-3 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium">Desafio da semana</span>
            <span className="text-xs text-muted-foreground">+{STARS.desafio} estrelas</span>
          </div>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Dia a dia até {money(challenge.limite)}</span>
            <span
              className={cn(
                'tabular-nums',
                challenge.gasto > challenge.limite && 'text-destructive',
              )}
            >
              {money(challenge.gasto)} de {money(challenge.limite)}
            </span>
          </div>
          <div aria-hidden className="h-2 overflow-hidden rounded-full bg-background">
            <div
              className={cn(
                'h-full rounded-full',
                challenge.gasto > challenge.limite ? 'bg-destructive' : 'bg-primary',
              )}
              style={{ width: `${Math.min(100, (challenge.gasto * 100) / challenge.limite)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {challenge.gasto > challenge.limite
              ? 'Passou do limite desta semana. Na próxima, de novo!'
              : `Faltam ${daysLeftInWeek(today) + 1} ${daysLeftInWeek(today) === 0 ? 'dia' : 'dias'}. Mercado, lanches e Uber contam; fixos e parcelas não.`}
          </p>
        </div>
      )}

      <Dialog open={celebrate !== null} onOpenChange={(open) => !open && setCelebrate(null)}>
        <SheetContent>
          {celebrate !== null && (
            <Celebration
              title="Dia fechado!"
              subtitle={`+${STARS.dia} estrela · ${celebrate} ${celebrate === 1 ? 'dia seguido' : 'dias seguidos'}`}
              next={
                celebrate < 7
                  ? {
                      label: `Faltam ${7 - celebrate} para 7 dias seguidos`,
                      progress: celebrate / 7,
                    }
                  : celebrate < 30
                    ? {
                        label: `Faltam ${30 - celebrate} para 30 dias seguidos`,
                        progress: celebrate / 30,
                      }
                    : undefined
              }
              onContinue={() => setCelebrate(null)}
            />
          )}
        </SheetContent>
      </Dialog>
    </section>
  )
}
