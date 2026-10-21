import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { FormAlert } from '@/components/form/FormAlert'
import { SelectField } from '@/components/form/SelectField'
import { TextField } from '@/components/form/TextField'
import { useServerAction } from '@/components/form/use-server-action'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { isCreditCard } from '@/features/accounts/account-options'
import type { Account } from '@/features/accounts/accounts-api'
import { todayIso } from '@/lib/dates'
import { centsToInput } from '@/lib/money'
import { MONEY_EXAMPLE } from '@/lib/money-schema'
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
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md">
        {props.open && props.person && (
          <ReimbursementForm key={props.person.id} {...props} person={props.person} />
        )}
      </DialogContent>
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
    .map((account) => ({ value: account.id, label: account.nome }))

  const {
    register,
    handleSubmit,
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
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Pagamento de {person.nome}</DialogTitle>
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
        className="text-lg font-medium tabular-nums"
        hint={MONEY_EXAMPLE}
        error={errors.valor?.message}
        {...register('valor')}
      />
      <SelectField
        id="reembolso-conta"
        label="Conta onde entrou"
        placeholder="Escolhe…"
        options={accountOptions}
        error={errors.accountId?.message}
        {...register('accountId')}
      />
      <TextField
        id="reembolso-data"
        label="Data"
        type="date"
        max={today}
        error={errors.data?.message}
        {...register('data')}
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

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" disabled={isSubmitting || create.isPending}>
          {isSubmitting ? 'A registar…' : 'Registar pagamento'}
        </Button>
      </DialogFooter>
    </form>
  )
}
