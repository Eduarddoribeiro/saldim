import type { RouteObject } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { NotFoundPage } from '@/components/layout/NotFoundPage'
import { AuthLayout } from '@/features/auth/AuthLayout'
import { PublicOnly, RequireAuth } from '@/features/auth/route-guards'
import { lazyPage as page } from '@/lib/lazy-page'

// Cada página é um ficheiro JS à parte, descarregado só quando se abre (divisão do bundle por rotas).
// Os layouts e as guardas ficam no ficheiro principal: aparecem logo e mostram o "A carregar…".
// O <Suspense> que espera pelas páginas está no AppShell e no AuthLayout.
const LoginPage = page(() => import('@/features/auth/LoginPage'), 'LoginPage')
const SignUpPage = page(() => import('@/features/auth/SignUpPage'), 'SignUpPage')
const ForgotPasswordPage = page(
  () => import('@/features/auth/ForgotPasswordPage'),
  'ForgotPasswordPage',
)
const ResetPasswordPage = page(
  () => import('@/features/auth/ResetPasswordPage'),
  'ResetPasswordPage',
)
const DashboardPage = page(() => import('@/features/dashboard/DashboardPage'), 'DashboardPage')
const TransactionsPage = page(
  () => import('@/features/transactions/TransactionsPage'),
  'TransactionsPage',
)
const BudgetsPage = page(() => import('@/features/budgets/BudgetsPage'), 'BudgetsPage')
const SettingsPage = page(() => import('@/features/settings/SettingsPage'), 'SettingsPage')
const CategoriesPage = page(() => import('@/features/categories/CategoriesPage'), 'CategoriesPage')
const AccountsPage = page(() => import('@/features/accounts/AccountsPage'), 'AccountsPage')

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
          { path: 'orcamentos', element: <BudgetsPage /> },
          { path: 'configuracoes', element: <SettingsPage /> },
          { path: 'configuracoes/categorias', element: <CategoriesPage /> },
          { path: 'configuracoes/contas', element: <AccountsPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]
