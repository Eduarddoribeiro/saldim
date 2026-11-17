import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  HandCoins,
  ReceiptText,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router'
import { useQuickEntry } from '@/features/quick-entry/quick-entry-context'

const circle =
  'flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/15'
const item =
  'group flex min-w-0 flex-col items-center gap-1.5 rounded-xl py-1 text-center text-xs font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none'

function Content({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <>
      <span className={circle}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="w-full truncate">{label}</span>
    </>
  )
}

/**
 * Atalhos redondos logo abaixo do saldo: lançar (abre o formulário já no modo certo), pagar a fatura e
 * receber de quem deve. Os do cartão só aparecem com cartões.
 */
export function QuickActions({ hasCards }: { hasCards: boolean }) {
  const openQuickEntry = useQuickEntry()
  return (
    <nav
      aria-label="Atalhos"
      className="relative -mt-8 mb-4 grid auto-cols-fr grid-flow-col gap-1 rounded-2xl border bg-card p-3 shadow-sm"
    >
      <button type="button" className={item} onClick={() => openQuickEntry({ tipo: 'despesa' })}>
        <Content icon={ArrowDownLeft} label="Despesa" />
      </button>
      <button type="button" className={item} onClick={() => openQuickEntry({ tipo: 'receita' })}>
        <Content icon={ArrowUpRight} label="Receita" />
      </button>
      {hasCards && (
        <button type="button" className={item} onClick={() => openQuickEntry({ card: true })}>
          <Content icon={CreditCard} label="No cartão" />
        </button>
      )}
      {hasCards && (
        <Link to="/faturas" className={item}>
          <Content icon={ReceiptText} label="Faturas" />
        </Link>
      )}
      <Link to="/a-receber" className={item}>
        <Content icon={HandCoins} label="Receber" />
      </Link>
    </nav>
  )
}
