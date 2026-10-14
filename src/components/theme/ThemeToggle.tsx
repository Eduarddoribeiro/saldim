import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { nextTheme, THEME_LABELS, type Theme } from '@/lib/theme'
import { useTheme } from './theme-context'

const ICONS: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor }

/** Alterna Claro → Escuro → Sistema. Com `showLabel` mostra o nome do tema ao lado do ícone. */
export function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const { theme, setTheme } = useTheme()
  const Icon = ICONS[theme]
  const next = nextTheme(theme)

  return (
    <Button
      variant="ghost"
      size={showLabel ? 'lg' : 'icon-lg'}
      className={showLabel ? 'w-full justify-start' : undefined}
      onClick={() => setTheme(next)}
      aria-label={`Tema: ${THEME_LABELS[theme]}. Mudar para ${THEME_LABELS[next]}`}
      title={`Mudar para tema ${THEME_LABELS[next]}`}
    >
      <Icon aria-hidden />
      {showLabel && <span>Tema: {THEME_LABELS[theme]}</span>}
    </Button>
  )
}
