import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CreditCard,
  HandCoins,
  PiggyBank,
  ReceiptText,
  Repeat,
  Star,
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
 * Atalhos redondos logo abaixo do saldo, em duas linhas de quatro (pedido de 2026-11-27: "mais botão
 * e menos rolagem"): lançar (o formulário já no modo certo), transferir, guardar, pagar a fatura,
 * receber de quem deve e os fixos. Os do cartão só aparecem com cartões (no lugar, a jornada).
 */
export function QuickActions({ hasCards }: { hasCards: boolean }) {
  const openQuickEntry = useQuickEntry()
  return (
    <nav
      aria-label="Atalhos"
      className="relative -mt-8 mb-4 grid grid-cols-4 gap-x-1 gap-y-3 rounded-2xl border bg-card p-3 shadow-sm"
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
      <button type="button" className={item} onClick={() => openQuickEntry({ transfer: {} })}>
        <Content icon={ArrowLeftRight} label="Transferir" />
      </button>
      <Link to="/guardar" className={item}>
        <Content icon={PiggyBank} label="Guardar" />
      </Link>
      {hasCards && (
        <Link to="/faturas" className={item}>
          <Content icon={ReceiptText} label="Faturas" />
        </Link>
      )}
      <Link to="/a-receber" className={item}>
        <Content icon={HandCoins} label="Receber" />
      </Link>
      <Link to="/fixos" className={item}>
        <Content icon={Repeat} label="Fixos" />
      </Link>
      {!hasCards && (
        <Link to="/jornada" className={item}>
          <Content icon={Star} label="Jornada" />
        </Link>
      )}
    </nav>
  )
}
