import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { ArchiveDeleteActions } from '@/components/form/ArchiveDeleteActions'
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
import { centsToInput } from '@/lib/money'
import { MONEY_EXAMPLE } from '@/lib/money-schema'
import { TIPO_CONTA_OPTIONS, TIPOS_CONTA } from './account-options'
import type { Account } from './accounts-api'
import { useCreateAccount, useDeleteAccount, useUpdateAccount } from './hooks'
import { accountFormSchema, type AccountFormInput, type AccountFormValues } from './schemas'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Conta a editar; sem ela, o diálogo cria uma nova. */
  account?: Account | null
}

export function AccountFormDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md">
        {props.open && <AccountForm key={props.account?.id ?? 'nova'} {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function AccountForm({ onOpenChange, account }: Props) {
  const { serverError, run } = useServerAction(() => onOpenChange(false))
  const create = useCreateAccount()
  const update = useUpdateAccount()
  const remove = useDeleteAccount()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormInput, unknown, AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: account
      ? {
          nome: account.nome,
          tipo: account.tipo,
          saldoInicial: centsToInput(account.saldo_inicial_centavos),
        }
      : { nome: '', tipo: 'corrente', saldoInicial: '0,00' },
  })

  const onSubmit = handleSubmit((values) =>
    run(() =>
      account
        ? update.mutateAsync({
            id: account.id,
            patch: {
              nome: values.nome,
              tipo: values.tipo,
              saldo_inicial_centavos: values.saldoInicial,
            },
          })
        : create.mutateAsync(values),
    ),
  )

  const busy = isSubmitting || update.isPending || remove.isPending

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{account ? 'Editar conta' : 'Nova conta'}</DialogTitle>
        <DialogDescription>Onde o teu dinheiro está: banco, poupança, carteira…</DialogDescription>
      </DialogHeader>

      {serverError && <FormAlert>{serverError}</FormAlert>}

      <TextField
        id="conta-nome"
        label="Nome"
        autoComplete="off"
        maxLength={40}
        placeholder="Ex.: Banco, Carteira"
        error={errors.nome?.message}
        {...register('nome')}
      />
      <SelectField
        id="conta-tipo"
        label="Tipo"
        options={TIPOS_CONTA.map((tipo) => ({
          value: tipo,
          label: TIPO_CONTA_OPTIONS[tipo].label,
        }))}
        error={errors.tipo?.message}
        {...register('tipo')}
      />
      <TextField
        id="conta-saldo-inicial"
        label="Saldo inicial"
        inputMode="decimal"
        autoComplete="off"
        hint={`Quanto tinha a conta quando começaste a usar o Saldo. Pode ser negativo. ${MONEY_EXAMPLE}`}
        error={errors.saldoInicial?.message}
        {...register('saldoInicial')}
      />

      {account && (
        <ArchiveDeleteActions
          itemName={account.nome}
          archived={account.arquivada}
          disabled={busy}
          deleteHint="Se a conta já tiver transações, arquiva-a em vez de a apagar."
          onToggleArchive={() =>
            run(() =>
              update.mutateAsync({ id: account.id, patch: { arquivada: !account.arquivada } }),
            )
          }
          onDelete={() => run(() => remove.mutateAsync(account.id))}
        />
      )}

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" disabled={busy}>
          {isSubmitting ? 'A guardar…' : account ? 'Guardar' : 'Criar conta'}
        </Button>
      </DialogFooter>
    </form>
  )
}
