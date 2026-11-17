import { Plus } from 'lucide-react'
import { NavLink } from 'react-router'
import { useQuickEntry } from '@/features/quick-entry/quick-entry-context'
import { cn } from '@/lib/utils'
import { MOBILE_NAV_ITEMS, type NavItem } from './nav-items'

/**
 * Barra de navegação inferior — só no telemóvel (abaixo de 768px): quatro destinos e, ao centro, o
 * `+` do lançamento rápido, ao alcance do polegar em qualquer página.
 */
export function BottomNav() {
  const openQuickEntry = useQuickEntry()
  const half = Math.ceil(MOBILE_NAV_ITEMS.length / 2)
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5 items-end">
        {MOBILE_NAV_ITEMS.slice(0, half).map((item) => (
          <BottomNavLink key={item.to} {...item} />
        ))}
        <li className="flex justify-center">
          <button
            type="button"
            onClick={() => openQuickEntry()}
            aria-label="Novo lançamento"
            className="-mt-5 mb-2 flex size-14 items-center justify-center rounded-full border-4 border-card bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95"
          >
            <Plus className="size-6" strokeWidth={2.5} aria-hidden />
          </button>
        </li>
        {MOBILE_NAV_ITEMS.slice(half).map((item) => (
          <BottomNavLink key={item.to} {...item} />
        ))}
      </ul>
    </nav>
  )
}

function BottomNavLink({ to, label, icon: Icon }: Pick<NavItem, 'to' | 'label' | 'icon'>) {
  return (
    <li>
      <NavLink
        to={to}
        end={to === '/'}
        className={({ isActive }) =>
          cn(
            // min-h-14 (56px): área de toque confortável
            'flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] leading-tight font-medium whitespace-nowrap transition-colors',
            'focus-visible:bg-muted focus-visible:outline-none',
            isActive ? 'text-primary' : 'text-muted-foreground',
          )
        }
      >
        <Icon className="size-5" aria-hidden />
        {label}
      </NavLink>
    </li>
  )
}
