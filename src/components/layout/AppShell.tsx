import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { QuickEntryProvider } from '@/features/quick-entry/QuickEntryProvider'
import { cn } from '@/lib/utils'
import { RecurringGenerator } from '@/features/recurring/RecurringGenerator'
import { PendingInviteRedirect } from '@/features/sharing/PendingInviteRedirect'
import { applyHiddenValues, readHiddenValues } from '@/lib/privacy'
import { AppLogo } from './AppLogo'
import { BottomNav } from './BottomNav'
import { PageLoader } from './PageLoader'
import { Sidebar } from './Sidebar'

/**
 * Esqueleto da app (mobile-first):
 * - telemóvel: cabeçalho no topo + barra de navegação em baixo
 * - desktop (md+): sidebar à esquerda, sem cabeçalho nem barra inferior
 */
export function AppShell() {
  // "Esconder valores" (o olho do Início) vale em todas as páginas, também ao abrir a app
  useEffect(() => applyHiddenValues(readHiddenValues()), [])
  // No Início, o cabeçalho do telemóvel continua a faixa do saldo (mesma cor, sem linha)
  const onHero = useLocation().pathname === '/'

  return (
    <QuickEntryProvider>
      <div className="flex min-h-svh">
        {/* Cria os lançamentos recorrentes que já chegaram ao dia (não mostra nada) */}
        <RecurringGenerator />
        {/* Convite aberto antes de entrar: volta a ele (não mostra nada) */}
        <PendingInviteRedirect />
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <header
            className={cn(
              'sticky top-0 z-30 flex h-14 items-center justify-between px-4 md:hidden',
              onHero ? 'bg-hero text-hero-foreground' : 'border-b bg-card/95 backdrop-blur',
            )}
          >
            <AppLogo onHero={onHero} />
            <ThemeToggle
              className={onHero ? 'hover:bg-white/10 hover:text-hero-foreground' : undefined}
            />
          </header>

          {/* pb-24 no telemóvel para o conteúdo não ficar escondido atrás da barra inferior */}
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 md:px-8 md:pt-8 md:pb-8">
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </main>
        </div>

        <BottomNav />
      </div>
    </QuickEntryProvider>
  )
}
