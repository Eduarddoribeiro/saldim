import type { RouteObject } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { NotFoundPage } from '@/components/layout/NotFoundPage'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { PublicOnly, RequireAuth } from '@/features/auth/route-guards'
import { SignUpPage } from '@/features/auth/SignUpPage'
import { CategoriesPage } from '@/features/categories/CategoriesPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { TransactionsPage } from '@/features/transactions/TransactionsPage'

// As rotas ficam separadas do router para os testes as poderem usar com um router em memória
export const routes: RouteObject[] = [
  // Só sem sessão
  {
    element: <PublicOnly />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: 'entrar', element: <LoginPage /> },
          { path: 'registar', element: <SignUpPage /> },
          { path: 'recuperar-senha', element: <ForgotPasswordPage /> },
        ],
      },
    ],
  },
  // Destino do link de recuperação: precisa da sessão temporária criada pelo link
  {
    element: <AuthLayout />,
    children: [{ path: 'nova-senha', element: <ResetPasswordPage /> }],
  },
  // Só com sessão
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'transacoes', element: <TransactionsPage /> },
          { path: 'configuracoes', element: <SettingsPage /> },
          { path: 'configuracoes/categorias', element: <CategoriesPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]
