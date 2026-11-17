import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { FormAlert } from '@/components/form/FormAlert'
import { TextField } from '@/components/form/TextField'
import { useServerAction } from '@/components/form/use-server-action'
import { SheetContent, SheetFooter } from '@/components/layout/SheetContent'
import { Button } from '@/components/ui/button'
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { isCreditCard, TIPO_CONTA_OPTIONS } from '@/features/accounts/account-options'
import type { Account } from '@/features/accounts/accounts-api'
import { ChoiceChips } from '@/features/quick-entry/ChoiceChips'
import { DateChips } from '@/features/quick-entry/DateChips'
import { todayIso } from '@/lib/dates'
import { centsToInput } from '@/lib/money'
import { useCreateReimbursement } from './hooks'
import type { Person } from './people-api'
import {
  reimbursementFormSchema,
  type ReimbursementFormInput,
  type ReimbursementFormOutput,
} from './schemas'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  person: Person | null
  accounts: Account[]
  /** Valor sugerido (o que já venceu, ou o total) */
  suggestedCents: number
}

export function ReimbursementFormDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className="pb-0">
        {props.open && props.person && (
          <ReimbursementForm key={props.person.id} {...props} person={props.person} />
        )}
      </SheetContent>
    </Dialog>
  )
}

function ReimbursementForm({
  onOpenChange,
  person,
  accounts,
  suggestedCents,
}: Props & { person: Person }) {
  const { serverError, run } = useServerAction(() => onOpenChange(false))
  const create = useCreateReimbursement()
  const today = todayIso()
  const schema = useMemo(() => reimbursementFormSchema(today), [today])
  // O dinheiro entra numa conta de dinheiro (a base de dados recusa cartões)
  const accountOptions = accounts
    .filter((account) => !isCreditCard(account) && !account.arquivada)
    .map((account) => ({
      value: account.id,
      label: account.nome,
      icon: TIPO_CONTA_OPTIONS[account.tipo].icon,
    }))

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ReimbursementFormInput, unknown, ReimbursementFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      valor: suggestedCents > 0 ? centsToInput(suggestedCents) : '',
      accountId: accountOptions[0]?.value ?? '',
      data: today,
      descricao: '',
    },
  })

  const onSubmit = handleSubmit((values) =>
    run(() => create.mutateAsync({ ...values, pessoaId: person.id })),
  )

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold">Pagamento de {person.nome}</DialogTitle>
        <DialogDescription>
          Dinheiro que {person.nome} te devolveu. Entra na conta, mas não conta como receita.
        </DialogDescription>
      </DialogHeader>

      {serverError && <FormAlert>{serverError}</FormAlert>}

      <TextField
        id="reembolso-valor"
        label="Valor"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,00"
        className="h-16 text-center text-4xl font-semibold tracking-tight tabular-nums md:text-4xl"
        error={errors.valor?.message}
        {...register('valor')}
      />
      {accountOptions.length === 0 ? (
        <FormAlert>Para registrar, você precisa de uma conta de dinheiro ativa.</FormAlert>
      ) : (
        <ChoiceChips
          legend="Entrou em"
          options={accountOptions}
          error={errors.accountId?.message}
          errorId="reembolso-conta-erro"
          {...register('accountId')}
        />
      )}
      <DateChips
        name="reembolso-data-escolha"
        fieldId="reembolso-data"
        today={today}
        initial={today}
        max={today}
        setDate={(date) => setValue('data', date)}
        field={register('data')}
        error={errors.data?.message}
      />
      <TextField
        id="reembolso-descricao"
        label="Descrição (opcional)"
        autoComplete="off"
        maxLength={120}
        placeholder="Ex.: Pix"
        error={errors.descricao?.message}
        {...register('descricao')}
      />

      <SheetFooter>
        <Button
          type="submit"
          size="lg"
          className="h-12 w-full rounded-full text-base"
          disabled={isSubmitting || create.isPending || accountOptions.length === 0}
        >
          {isSubmitting ? 'Registrando…' : 'Registrar pagamento'}
        </Button>
      </SheetFooter>
    </form>
  )
}
