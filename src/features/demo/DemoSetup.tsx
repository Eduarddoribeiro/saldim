import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { FormAlert } from '@/components/form/FormAlert'
import { AppLogo } from '@/components/layout/AppLogo'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { DEMO_MODE } from '@/lib/demo-mode'
import { errorMessage } from '@/lib/db-errors'
import { hasTransactions, prepareDemo } from './demo-api'

type State =
  | { kind: 'checking' }
  | { kind: 'ready' }
  | { kind: 'seeding'; progress: number }
  | {
      kind: 'error'
      message: string
    }

/**
 * Demo pública: na conta anónima de um visitante, prepara os dados inventados (uma vez) e mostra
 * uma faixa a dizer que é uma demonstração. Fora da demo, ou numa conta normal, não faz nada.
 */
export function DemoSetup() {
  const { user, signOut } = useAuth()
  const active = DEMO_MODE && Boolean(user?.is_anonymous)
  const queryClient = useQueryClient()
  const [state, setState] = useState<State>({ kind: 'checking' })
  const started = useRef<string | null>(null)

  useEffect(() => {
    if (!active || !user || started.current === user.id) return
    started.current = user.id
    void (async () => {
      try {
        if (await hasTransactions()) {
          setState({ kind: 'ready' })
          return
        }
        setState({ kind: 'seeding', progress: 0 })
        await prepareDemo((progress) => setState({ kind: 'seeding', progress }))
        await queryClient.invalidateQueries()
        setState({ kind: 'ready' })
      } catch (error) {
        setState({ kind: 'error', message: errorMessage(error) })
      }
    })()
  }, [active, user, queryClient])

  if (!active) return null

  if (state.kind === 'seeding' || state.kind === 'error') {
    const percent = state.kind === 'seeding' ? Math.round(state.progress * 100) : 0
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background px-6">
        <div className="grid w-full max-w-xs justify-items-center gap-4 text-center">
          <AppLogo />
          {state.kind === 'seeding' ? (
            <>
              <p role="status" className="text-sm text-muted-foreground">
                Preparando 6 meses de dados de exemplo…
              </p>
              <div
                role="progressbar"
                aria-label="Preparando a demonstração"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <FormAlert>{state.message}</FormAlert>
              <Button variant="outline" onClick={() => void signOut()}>
                Voltar
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  // Faixa fina no topo: é uma demonstração, com dados inventados só deste visitante
  return (
    <div className="bg-primary px-4 py-1.5 text-center text-xs font-medium text-primary-foreground">
      Demonstração com dados fictícios: explore e mexa à vontade.
    </div>
  )
}
