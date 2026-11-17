import {
  ArrowLeftRight,
  CreditCard,
  LayoutDashboard,
  Menu,
  Settings,
  Target,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  /** Na barra inferior (telemóvel): nome e ícone mais curtos, ou fora da barra (`false`) */
  mobile?: { label: string; icon: LucideIcon } | false
}

// Fonte única da navegação: usada pela sidebar (desktop) e pela barra inferior (telemóvel).
// Os caminhos não mudaram com os nomes (Extrato = /transacoes, Cartões = /faturas): ligações antigas
// continuam a funcionar.
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Início', icon: LayoutDashboard },
  { to: '/transacoes', label: 'Extrato', icon: ArrowLeftRight },
  { to: '/faturas', label: 'Cartões', icon: CreditCard },
  // No telemóvel, Orçamentos e A receber ficam em "Mais" (a página de Configurações)
  { to: '/orcamentos', label: 'Orçamentos', icon: Target, mobile: false },
  {
    to: '/configuracoes',
    label: 'Configurações',
    icon: Settings,
    mobile: { label: 'Mais', icon: Menu },
  },
]

/** Itens da barra inferior, com o nome e o ícone do telemóvel. */
export const MOBILE_NAV_ITEMS = NAV_ITEMS.flatMap((item) =>
  item.mobile === false ? [] : [{ ...item, ...item.mobile }],
)
