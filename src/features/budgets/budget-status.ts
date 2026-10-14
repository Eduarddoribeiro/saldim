import { CircleAlert, CircleCheck, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { BudgetState } from '@/lib/finance'

// Estado = cor + ícone + texto (nunca só cor). Cores de estado reservadas: não usar para outras coisas.
export const BUDGET_STATE: Record<
  BudgetState,
  { label: string; icon: LucideIcon; text: string; bar: string }
> = {
  ok: {
    label: 'Dentro do orçamento',
    icon: CircleCheck,
    text: 'text-emerald-700 dark:text-emerald-400',
    bar: 'bg-emerald-600 dark:bg-emerald-500',
  },
  alerta: {
    label: 'Perto do limite',
    icon: TriangleAlert,
    text: 'text-amber-700 dark:text-amber-400',
    bar: 'bg-amber-500',
  },
  excedido: {
    label: 'Excedido',
    icon: CircleAlert,
    text: 'text-red-700 dark:text-red-400',
    bar: 'bg-red-600 dark:bg-red-500',
  },
}
