import { useEffect, useRef } from 'react'
import { useAuth } from '@/features/auth/auth-context'
import { todayIso } from '@/lib/dates'
import { useGenerateRecurring } from './hooks'

/**
 * Cria os lançamentos recorrentes que já chegaram ao dia (D15): ao abrir a app e, se ela ficar aberta
 * de um dia para o outro, quando volta a ficar visível. Uma vez por utilizador e por dia; se falhar
 * (ex.: sem rede), tenta de novo na próxima vez. Não mostra nada: os lançamentos aparecem nas listas.
 */
export function RecurringGenerator() {
  const { user } = useAuth()
  const generate = useGenerateRecurring()
  const done = useRef<string | null>(null)

  useEffect(() => {
    if (!user) return
    const run = () => {
      const key = `${user.id}:${todayIso()}`
      if (done.current === key) return
      done.current = key
      generate().catch(() => {
        done.current = null
      })
    }
    run()
    const onVisible = () => {
      if (document.visibilityState === 'visible') run()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [user, generate])

  return null
}
