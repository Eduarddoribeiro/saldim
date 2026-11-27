import { CalendarCheck, Flame, Lock, Star } from 'lucide-react'
import { FormAlert } from '@/components/form/FormAlert'
import { PageHeader } from '@/components/layout/PageHeader'
import { addDays, formatMonth, lastDayOfMonth, type IsoDate } from '@/lib/dates'
import { errorMessage } from '@/lib/db-errors'
import { cn } from '@/lib/utils'
import { weekStart } from './journey'
import { useJourney } from './use-journey'

/**
 * Sua jornada (/jornada, pedido de 2026-11-26): o nível e quanto falta, o mês em dias fechados, de
 * onde vieram as estrelas e as conquistas (as trancadas dizem o que falta).
 */
export function JourneyPage() {
  const journey = useJourney()
  const header = (
    <PageHeader
      title="Sua jornada"
      description="Estrelas por hábitos que deixam o seu dinheiro em dia."
    />
  )
  if (journey.error) {
    return (
      <>
        {header}
        <FormAlert>{errorMessage(journey.error)}</FormAlert>
      </>
    )
  }
  if (!journey.data) {
    return (
      <>
        {header}
        <p role="status" className="text-sm text-muted-foreground">
          Carregando…
        </p>
      </>
    )
  }
  const { today, closed, streak, best, stars, level, badges } = journey.data
  const month = today.slice(0, 7)
  const from: IsoDate = `${month}-01`
  const to = lastDayOfMonth(month)
  const folgas = new Set(streak.folgas)
  // Calendário de segunda a domingo: espaços antes do dia 1
  const lead = Math.round((Date.parse(from) - Date.parse(weekStart(from))) / 86_400_000)
  const monthDays: IsoDate[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) monthDays.push(day)
  const closedThisMonth = monthDays.filter((day) => closed.has(day)).length
  const won = badges.filter((badge) => badge.ganha).length

  return (
    <>
      {header}
      <div className="grid min-w-0 gap-4 *:min-w-0 md:max-w-2xl">
        <section aria-label="Nível" className="grid gap-3 rounded-2xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3 py-1 text-sm font-semibold text-orange-600 dark:text-orange-300">
              <Flame className="size-4" aria-hidden />
              {streak.atual} {streak.atual === 1 ? 'dia seguido' : 'dias seguidos'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 text-sm font-semibold text-amber-700 dark:text-amber-300">
              <Star className="size-4 fill-current" aria-hidden />
              {stars.total} estrelas
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">
              Nível {level.nivel} · {level.nome}
            </h2>
            {level.proximo && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {stars.total} de {level.proximo.desde}
              </span>
            )}
          </div>
          <div
            role="progressbar"
            aria-label="Progresso até o próximo nível"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(level.progresso * 100)}
            className="h-2.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-amber-400"
              style={{ width: `${level.progresso * 100}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {level.proximo
              ? `Mais ${level.proximo.desde - stars.total} estrelas para ${level.proximo.nome}.`
              : 'Você chegou ao último nível.'}
          </p>
        </section>

        <section
          aria-labelledby="mes-jornada"
          className="grid gap-3 rounded-2xl border bg-card p-4"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="mes-jornada" className="font-semibold first-letter:uppercase">
              {formatMonth(month)}
            </h2>
            <span className="text-xs text-muted-foreground">
              {closedThisMonth} {closedThisMonth === 1 ? 'dia fechado' : 'dias fechados'}
            </span>
          </div>
          <div
            aria-hidden
            className="grid grid-cols-7 gap-1.5 text-center text-[11px] text-muted-foreground"
          >
            {['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((name) => (
              <span key={name}>{name}</span>
            ))}
            {Array.from({ length: lead }, (_, index) => (
              <span key={`vazio-${index}`} />
            ))}
            {monthDays.map((day) => (
              <span
                key={day}
                className={cn(
                  'flex aspect-square items-center justify-center rounded-md bg-muted tabular-nums',
                  closed.has(day) && 'bg-orange-500/70 text-white',
                  folgas.has(day) && 'bg-primary/40 text-foreground',
                  day === today && 'ring-2 ring-orange-400',
                  day > today && 'opacity-40',
                )}
              >
                {Number(day.slice(8, 10))}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Laranja: dia fechado · azul: folga da semana (um dia esquecido por semana não quebra a
            sequência). Maior sequência: {best} {best === 1 ? 'dia' : 'dias'}.
          </p>
        </section>

        <section
          aria-labelledby="de-onde-estrelas"
          className="grid gap-2 rounded-2xl border bg-card p-4"
        >
          <h2 id="de-onde-estrelas" className="font-semibold">
            De onde vêm as estrelas
          </h2>
          <ul aria-label="De onde vêm as estrelas" className="divide-y text-sm">
            {stars.lines.map((row) => (
              <li key={row.id} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0">
                  {row.label}
                  <span className="text-muted-foreground">
                    {row.cada > 0 ? ` · +${row.cada} cada` : ' · R$ 100, R$ 500, 1 mês, 3 meses'}
                  </span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {row.vezes > 0 ? `${row.total}` : '—'}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="conquistas" className="grid gap-3 rounded-2xl border bg-card p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="conquistas" className="font-semibold">
              Conquistas
            </h2>
            <span className="text-xs text-muted-foreground">
              {won} de {badges.length}
            </span>
          </div>
          <ul aria-label="Conquistas" className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {badges.map((badge) => (
              <li
                key={badge.id}
                aria-label={`${badge.nome}: ${badge.ganha ? 'ganha' : `trancada, ${badge.falta ?? ''}`}`}
                className={cn(
                  'grid justify-items-center gap-1.5 text-center text-xs',
                  !badge.ganha && 'text-muted-foreground',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex size-12 items-center justify-center rounded-2xl bg-muted',
                    badge.ganha && 'bg-amber-400/15 text-amber-600 dark:text-amber-300',
                  )}
                >
                  {badge.ganha ? (
                    badge.id.startsWith('seq') ? (
                      <Flame className="size-6" />
                    ) : badge.id === 'mes' ? (
                      <CalendarCheck className="size-6" />
                    ) : (
                      <Star className="size-6 fill-current" />
                    )
                  ) : (
                    <Lock className="size-5 opacity-50" />
                  )}
                </span>
                <span aria-hidden className={cn('leading-tight', badge.ganha && 'font-medium')}>
                  {badge.nome}
                  {!badge.ganha && badge.falta && (
                    <span className="block text-[11px]">{badge.falta}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
