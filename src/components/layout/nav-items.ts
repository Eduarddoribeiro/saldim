import {
  ArrowLeftRight,
  CreditCard,
  LayoutDashboard,
  Settings,
  Target,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
}

// Fonte única da navegação: usada pela sidebar (desktop) e pela barra inferior (telemóvel)
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Início', icon: LayoutDashboard },
  { to: '/transacoes', label: 'Transações', icon: ArrowLeftRight },
  { to: '/faturas', label: 'Faturas', icon: CreditCard },
  { to: '/orcamentos', label: 'Orçamentos', icon: Target },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]
