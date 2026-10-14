import { Outlet } from 'react-router'
import { AppLogo } from '@/components/layout/AppLogo'
import { ThemeToggle } from '@/components/theme/ThemeToggle'

/** Moldura das páginas de autenticação: cartão centrado, sem navegação da app. */
export function AuthLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 items-center justify-between px-4">
        <AppLogo />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-12 sm:items-center sm:pt-0">
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
