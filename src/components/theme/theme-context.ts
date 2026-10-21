import { createContext, useContext } from 'react'
import type { ResolvedTheme, Theme } from '@/lib/theme'

export type ThemeContextValue = {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme precisa ser usado dentro de <ThemeProvider>')
  return context
}
