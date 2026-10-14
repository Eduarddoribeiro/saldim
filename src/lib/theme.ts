export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

// Mesma chave usada pelo script inline em index.html (evita o "flash" de tema errado)
export const THEME_STORAGE_KEY = 'financas-theme'

const THEME_ORDER: Theme[] = ['light', 'dark', 'system']

export const THEME_LABELS: Record<Theme, string> = {
  light: 'Claro',
  dark: 'Escuro',
  system: 'Sistema',
}

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEME_ORDER as string[]).includes(value)
}

/** "system" segue a preferência do sistema operativo. */
export function resolveTheme(theme: Theme, systemPrefersDark: boolean): ResolvedTheme {
  if (theme === 'system') return systemPrefersDark ? 'dark' : 'light'
  return theme
}

/** Ordem do botão de tema: Claro → Escuro → Sistema → Claro… */
export function nextTheme(theme: Theme): Theme {
  return THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length]
}

// localStorage pode lançar erro (modo privado, armazenamento bloqueado): nunca deixamos isso partir a app.
export function readStoredTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Sem armazenamento: o tema vale só para esta sessão.
  }
}
