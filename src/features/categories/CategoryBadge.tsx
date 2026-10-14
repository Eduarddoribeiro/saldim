import { cn } from '@/lib/utils'
import { CATEGORY_ICONS, colorOf, type CategoryIcon } from './category-options'

/** Ícone da categoria num círculo com a sua cor. Decorativo: o nome aparece sempre ao lado. */
export function CategoryBadge({
  cor,
  icone,
  size = 'md',
  className,
}: {
  cor: string
  icone: string
  size?: 'sm' | 'md'
  className?: string
}) {
  // Consulta direta (estática) ao mapa de ícones; chave desconhecida → etiqueta
  const Icon = (CATEGORY_ICONS[icone as CategoryIcon] ?? CATEGORY_ICONS.tag).icon
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full',
        size === 'md' ? 'size-9' : 'size-7',
        colorOf(cor).badge,
        className,
      )}
    >
      <Icon className={size === 'md' ? 'size-4.5' : 'size-3.5'} />
    </span>
  )
}
