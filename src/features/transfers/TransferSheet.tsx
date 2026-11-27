import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { FormAlert } from '@/components/form/FormAlert'
import { TextField } from '@/components/form/TextField'
import { useServerAction } from '@/components/form/use-server-action'
import { SheetContent, SheetFooter } from '@/components/layout/SheetContent'
import { Button } from '@/components/ui/button'
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { isCreditCard, isSavings, TIPO_CONTA_OPTIONS } from '@/features/accounts/account-options'
import { useAccounts } from '@/features/accounts/hooks'
import { Celebration } from '@/features/journey/Celebration'
import { RESERVE_STARS } from '@/features/journey/journey'
import { ChoiceChips } from '@/features/quick-entry/ChoiceChips'
import { DateChips } from '@/features/quick-entry/DateChips'
import { todayIso } from '@/lib/dates'
import { centsToInput } from '@/lib/money'
import { MONEY_EXAMPLE } from '@/lib/money-schema'
import { useCreateTransfer } from './hooks'
import { transferFormSchema, type TransferFormInput, type TransferFormOutput } from './schemas'

export type TransferPreset = {
  /** Conta de destino escolhida (ex.: a caixinha da reserva) */
  toAccountId?: string
  /** Valor sugerido, em centavos */
  valor?: number
  descricao?: string
}

/**
 * Transferir entre contas suas (pedido de 2026-11-26: guardar na reserva). Não é receita nem
 * despesa: só muda o dinheiro de conta. Indo para uma conta Poupança/Investimentos, celebra.
 */
export function TransferSheet({
  open,
  onOpenChange,
  preset,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  preset?: TransferPreset
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent className="pb-0">
        {open && <TransferForm preset={preset} onClose={() => onOpenChange(false)} />}
      </SheetContent>
    </Dialog>
  )
}

function TransferForm({ preset, onClose }: { preset?: TransferPreset; onClose: () => void }) {
  const accounts = useAccounts()
  const create = useCreateTransfer()
  const [saved, setSaved] = useState<{ valor: number; reserva: boolean } | null>(null)
  const { serverError, run } = useServerAction(() => {})
  const today = todayIso()
  const schema = useMemo(() => transferFormSchema(today), [today])
  const moneyAccounts = (accounts.data ?? []).filter(
    (account) => !account.arquivada && !isCreditCard(account),
  )
  // De onde sai: a primeira conta que não é de guardar (a de gastar)
  const defaultFrom =
    moneyAccounts.find((account) => !isSavings(account) && account.id !== preset?.toAccountId) ??
    moneyAccounts.find((account) => account.id !== preset?.toAccountId)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TransferFormInput, unknown, TransferFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      contaOrigemId: defaultFrom?.id ?? '',
      contaDestinoId: preset?.toAccountId ?? '',
      valor: preset?.valor ? centsToInput(preset.valor) : '',
      data: today,
      descricao: preset?.descricao ?? '',
    },
  })
  const [origem, destino] = useWatch({ control, name: ['contaOrigemId', 'contaDestinoId'] })

  if (saved) {
    return (
      <Celebration
        title={saved.reserva ? 'Guardado!' : 'Transferência registrada'}
        subtitle={
          saved.reserva
            ? `+${RESERVE_STARS} estrelas · a sua reserva cresceu`
            : 'O dinheiro mudou de conta; não conta como gasto.'
        }
        onContinue={onClose}
      />
    )
  }

  const options = (exclude: string) =>
    moneyAccounts
      .filter((account) => account.id !== exclude)
      .map((account) => ({
        value: account.id,
        label: account.nome,
        icon: TIPO_CONTA_OPTIONS[account.tipo].icon,
      }))

  const onSubmit = handleSubmit((values) =>
    run(async () => {
      await create.mutateAsync({
        contaOrigemId: values.contaOrigemId,
        contaDestinoId: values.contaDestinoId,
        valor: values.valor,
        data: values.data,
        descricao: values.descricao,
      })
      const to = moneyAccounts.find((account) => account.id === values.contaDestinoId)
      setSaved({ valor: values.valor, reserva: Boolean(to && isSavings(to)) })
    }),
  )

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold">Transferir entre contas</DialogTitle>
        <DialogDescription>
          Mover dinheiro entre contas suas (ex.: guardar na caixinha). Não conta como gasto nem como
          receita.
        </DialogDescription>
      </DialogHeader>
      {serverError && <FormAlert>{serverError}</FormAlert>}
      {moneyAccounts.length < 2 ? (
        <p className="text-sm text-muted-foreground">
          Você precisa de pelo menos duas contas.{' '}
          <Link to="/configuracoes/contas" onClick={onClose} className="font-medium text-primary">
            Criar uma conta
          </Link>
        </p>
      ) : (
        <>
          <TextField
            id="transferencia-valor"
            label="Valor"
            inputMode="decimal"
            autoComplete="off"
            placeholder={MONEY_EXAMPLE}
            error={errors.valor?.message}
            {...register('valor')}
          />
          <ChoiceChips
            legend="Sai de"
            name="transferencia-origem"
            options={options('')}
            selected={origem}
            onChange={(event) => setValue('contaOrigemId', event.target.value)}
            error={errors.contaOrigemId?.message}
            errorId="transferencia-origem-erro"
          />
          <ChoiceChips
            legend="Vai para"
            name="transferencia-destino"
            options={options(origem)}
            selected={destino}
            onChange={(event) => setValue('contaDestinoId', event.target.value)}
            error={errors.contaDestinoId?.message}
            errorId="transferencia-destino-erro"
          />
          <DateChips
            name="transferencia-data-escolha"
            fieldId="transferencia-data"
            today={today}
            initial={today}
            max={today}
            setDate={(date) => setValue('data', date)}
            field={register('data')}
            error={errors.data?.message}
          />
          <TextField
            id="transferencia-descricao"
            label="Descrição (opcional)"
            autoComplete="off"
            maxLength={120}
            placeholder="Ex.: Reserva"
            error={errors.descricao?.message}
            {...register('descricao')}
          />
        </>
      )}
      <SheetFooter>
        <Button
          type="submit"
          size="lg"
          className="h-12 w-full rounded-full text-base"
          disabled={isSubmitting || create.isPending || moneyAccounts.length < 2}
        >
          {isSubmitting ? 'Transferindo…' : 'Transferir'}
        </Button>
      </SheetFooter>
    </form>
  )
}
