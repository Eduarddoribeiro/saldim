import { useState } from 'react'
import { FormAlert } from '@/components/form/FormAlert'
import { TextField } from '@/components/form/TextField'
import { SheetContent, SheetFooter } from '@/components/layout/SheetContent'
import { Button } from '@/components/ui/button'
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Account } from '@/features/accounts/accounts-api'
import { useCategories } from '@/features/categories/hooks'
import { useCreateTransaction } from '@/features/transactions/hooks'
import { todayIso } from '@/lib/dates'
import { errorMessage } from '@/lib/db-errors'
import { parseMoney } from '@/lib/money'
import { MONEY_EXAMPLE } from '@/lib/money-schema'

/** Nome do lançamento do rendimento (fica fora das entradas fixas, em repeating.ts) */
export const YIELD_DESCRIPTION = 'Rendimento'

/**
 * Acertar a reserva com o banco: escreve-se quanto a caixinha tem agora e a diferença entra como
 * receita "Rendimento" nessa conta. O app não lê o banco; isto deixa o "Já tem" igual ao real.
 */
export function AdjustYieldDialog({
  open,
  onOpenChange,
  account,
  saved,
  money,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: Account
  saved: number
  money: (cents: number) => string
}) {
  const categories = useCategories()
  const create = useCreateTransaction()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const typed = parseMoney(text)
  const diff = typed === null ? null : typed - saved
  const receitas = (categories.data ?? []).filter(
    (category) => category.tipo === 'receita' && !category.arquivada,
  )
  const category =
    receitas.find((item) => /rendim|invest/i.test(item.nome)) ??
    receitas.find((item) => /outras/i.test(item.nome)) ??
    receitas[0]

  const submit = async () => {
    setError(null)
    if (diff === null || diff <= 0 || !category) return
    try {
      await create.mutateAsync({
        tipo: 'receita',
        valor: diff,
        data: todayIso(),
        categoryId: category.id,
        accountId: account.id,
        descricao: YIELD_DESCRIPTION,
      })
      setText('')
      onOpenChange(false)
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent className="pb-0">
        <div className="grid gap-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Acertar com o banco</DialogTitle>
            <DialogDescription>
              Quanto tem na {account.nome} agora, no app do banco? A diferença entra como
              rendimento.
            </DialogDescription>
          </DialogHeader>
          {error && <FormAlert>{error}</FormAlert>}
          <TextField
            id="rendimento-saldo"
            label="Saldo no banco"
            inputMode="decimal"
            autoComplete="off"
            placeholder={MONEY_EXAMPLE}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          {diff !== null && (
            <p className="text-sm text-muted-foreground tabular-nums">
              {diff > 0
                ? `Rendeu ${money(diff)} desde o último acerto: entra como receita "${YIELD_DESCRIPTION}".`
                : diff === 0
                  ? 'Já está igual ao banco.'
                  : `O banco tem ${money(-diff)} a menos do que o app. Confira se registrou uma retirada (Transferir, da caixinha para a sua conta).`}
            </p>
          )}
          <SheetFooter>
            <Button
              size="lg"
              className="h-12 w-full rounded-full text-base"
              disabled={diff === null || diff <= 0 || !category || create.isPending}
              onClick={() => void submit()}
            >
              Registrar rendimento
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Dialog>
  )
}
