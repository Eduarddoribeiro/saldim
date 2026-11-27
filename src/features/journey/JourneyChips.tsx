import { Flame, Star } from 'lucide-react'
import { Link } from 'react-router'
import { useJourney } from './use-journey'

/** Na faixa do Início: dias seguidos, estrelas e nível; um toque abre a jornada. */
export function JourneyChips() {
  const journey = useJourney()
  if (!journey.data) return null
  const { streak, stars, level } = journey.data
  return (
    <Link
      to="/jornada"
      aria-label={`Sua jornada: ${streak.atual} ${streak.atual === 1 ? 'dia seguido' : 'dias seguidos'}, ${stars.total} estrelas, nível ${level.nivel} ${level.nome}`}
      className="mb-4 flex flex-wrap gap-2 rounded-full focus-visible:ring-3 focus-visible:ring-white/40 focus-visible:outline-none"
    >
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-sm font-semibold">
        <Flame className="size-4 text-orange-300" aria-hidden />
        <span className="tabular-nums">{streak.atual}</span> {streak.atual === 1 ? 'dia' : 'dias'}
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-sm font-semibold">
        <Star className="size-4 fill-amber-300 text-amber-300" aria-hidden />
        <span className="tabular-nums">{stars.total}</span>
      </span>
      <span className="inline-flex items-center rounded-full bg-white/12 px-3 py-1 text-sm font-medium">
        Nível {level.nivel} · {level.nome}
      </span>
    </Link>
  )
}
