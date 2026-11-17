import type { ComponentProps } from 'react'
import { DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/**
 * Conteúdo de um diálogo que, no telemóvel, é uma folha que sobe de baixo (como nos apps de banco):
 * presa ao fundo, cantos de cima arredondados, com um puxador. No desktop continua um diálogo centrado.
 * Usada no lançamento rápido, na edição de transações, no detalhe da compra e nos pagamentos.
 */
export function SheetContent({
  className,
  children,
  ...props
}: ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent
      className={cn(
        'max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md',
        'max-md:top-auto max-md:bottom-0 max-md:left-0 max-md:max-h-[92svh] max-md:max-w-full max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-t-3xl max-md:rounded-b-none max-md:data-open:zoom-in-100 max-md:data-open:slide-in-from-bottom-8',
        className,
      )}
      {...props}
    >
      {/* Puxador: só desenho, indica que é uma folha */}
      <span aria-hidden className="mx-auto -mt-1 h-1 w-10 rounded-full bg-border md:hidden" />
      {children}
    </DialogContent>
  )
}

/**
 * Rodapé da folha com a ação principal: fica colado ao fundo, visível mesmo com o teclado aberto.
 * O pai tem de ter `pb-0` (a folha) para o rodapé encostar ao fundo.
 */
export function SheetFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'sticky bottom-0 -mx-4 grid gap-2 border-t bg-popover/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur',
        className,
      )}
      {...props}
    />
  )
}
