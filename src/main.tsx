import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { UserCacheBoundary } from '@/features/auth/UserCacheBoundary'
import { createQueryClient } from '@/lib/query-client'
import { routes } from '@/routes'
import './index.css'

const router = createBrowserRouter(routes)
const queryClient = createQueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <UserCacheBoundary>
            <RouterProvider router={router} />
          </UserCacheBoundary>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
