import { Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AppLogo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 font-semibold tracking-tight', className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Wallet className="size-4" aria-hidden />
      </span>
      Saldo
    </div>
  )
}
