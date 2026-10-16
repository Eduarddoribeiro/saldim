import { Suspense } from 'react'
import { Outlet } from 'react-router'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { RecurringGenerator } from '@/features/recurring/RecurringGenerator'
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
  return (
    <div className="flex min-h-svh">
      {/* Cria os lançamentos recorrentes que já chegaram ao dia (não mostra nada) */}
      <RecurringGenerator />
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:hidden">
          <AppLogo />
          <ThemeToggle />
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
  )
}
