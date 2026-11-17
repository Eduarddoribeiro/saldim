import { ChevronRight, HandCoins } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import { useCurrency } from '@/features/profile/hooks'
import { useBalanceMovements } from '@/features/transactions/hooks'
import { todayIso } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { useSharedDebts } from './hooks'
import { ownerLabel, summarizeSharedDebt } from './shared-debt'

const OPENED_KEY = 'saldim-o-que-devo-aberto'

/**
 * No Início de quem foi convidado: "Você deve a Edu R$ …" com um toque para o detalhe. Quem só usa
 * o Saldim para isto (sem lançamentos próprios) vai direto para "O que eu devo" ao abrir a app
 * (uma vez por sessão do browser, para ainda poder ver o Início).
 */
export function SharedDebtBanner() {
  const debts = useSharedDebts()
  const movements = useBalanceMovements()
  const currency = useCurrency()
  const navigate = useNavigate()
  const list = debts.data ?? []
  const onlyViewer = list.length > 0 && movements.data !== undefined && movements.data.length === 0

  useEffect(() => {
    if (!onlyViewer) return
    try {
      if (sessionStorage.getItem(OPENED_KEY)) return
      sessionStorage.setItem(OPENED_KEY, '1')
    } catch {
      return
    }
    navigate('/o-que-devo')
  }, [onlyViewer, navigate])

  if (list.length === 0) return null
  const today = todayIso()
  return (
    <div className="mb-4 grid gap-2">
      {list.map((debt) => {
        const { total } = summarizeSharedDebt(debt, today)
        const amount = formatMoney(Math.max(total, 0), currency)
        const owner = ownerLabel(debt)
        return (
          <Link
            key={debt.pessoaId}
            to="/o-que-devo"
            aria-label={`Você deve a ${owner}: ${amount}. Ver o que eu devo`}
            className="flex min-h-16 items-center gap-3 rounded-2xl border bg-card p-3 pl-4 transition-colors hover:bg-muted/50"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <HandCoins className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">Você deve a {owner}</span>
              <span className="block truncate text-xs text-muted-foreground">
                Ver o que eu devo, mês a mês
              </span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{amount}</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        )
      })}
    </div>
  )
}
