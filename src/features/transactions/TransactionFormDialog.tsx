import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { ArchiveDeleteActions } from '@/components/form/ArchiveDeleteActions'
import { FormAlert } from '@/components/form/FormAlert'
import { SegmentedControl } from '@/components/form/SegmentedControl'
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
import type { Category } from '@/features/categories/categories-api'
import { TIPO_LABELS, TIPOS } from '@/features/categories/schemas'
import { todayIso } from '@/lib/dates'
import { centsToInput } from '@/lib/money'
import { MONEY_EXAMPLE } from '@/lib/money-schema'
import { useCreateTransaction, useDeleteTransaction, useUpdateTransaction } from './hooks'
import {
  transactionFormSchema,
  type TransactionFormInput,
  type TransactionFormValues,
} from './schemas'
import type { PlainTransaction } from './transaction-kind'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Transação a editar; sem ela, o diálogo cria uma nova. */
  transaction?: PlainTransaction | null
  categories: Category[]
  accounts: Account[]
}

export function TransactionFormDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md">
        {props.open && <TransactionForm key={props.transaction?.id ?? 'nova'} {...props} />}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Opções de uma lista: só as ativas, mais a que já estiver escolhida (uma transação antiga pode
 * usar uma categoria/conta entretanto arquivada e tem de continuar editável).
 */
function selectable<T extends { id: string; nome: string; arquivada: boolean }>(
  items: T[],
  currentId: string | undefined,
) {
  return items
    .filter((item) => !item.arquivada || item.id === currentId)
    .map((item) => ({
      value: item.id,
      label: item.arquivada ? `${item.nome} (arquivada)` : item.nome,
    }))
}

function TransactionForm({ onOpenChange, transaction, categories, accounts }: Props) {
  const { serverError, run } = useServerAction(() => onOpenChange(false))
  const create = useCreateTransaction()
  const update = useUpdateTransaction()
  const remove = useDeleteTransaction()
  const firstActiveAccount = accounts.find(
    (account) => !account.arquivada && !isCreditCard(account),
  )

  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormInput, unknown, TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: transaction
      ? {
          tipo: transaction.tipo,
          valor: centsToInput(transaction.valor_centavos),
          data: transaction.data,
          categoryId: transaction.category_id,
          accountId: transaction.account_id,
          descricao: transaction.descricao,
        }
      : {
          tipo: 'despesa',
          valor: '',
          data: todayIso(),
          categoryId: '',
          accountId: firstActiveAccount?.id ?? '',
          descricao: '',
        },
  })

  const tipo = useWatch({ control, name: 'tipo' })
  const categoryOptions = selectable(
    categories.filter((category) => category.tipo === tipo),
    transaction?.category_id,
  )
  // Cartões ficam de fora: as compras no cartão têm fatura e parcelas e um fluxo próprio (a base de
  // dados também o recusa — trigger transactions_check_cartao)
  const accountOptions = selectable(
    accounts.filter((account) => !isCreditCard(account)),
    transaction?.account_id,
  )

  // Se o diálogo abriu antes de as contas chegarem do servidor, pré-seleciona a primeira assim que chegam.
  useEffect(() => {
    if (!transaction && !getValues('accountId') && firstActiveAccount) {
      setValue('accountId', firstActiveAccount.id)
    }
  }, [transaction, firstActiveAccount, getValues, setValue])

  // Ao trocar Despesa ↔ Receita, uma categoria do outro tipo deixa de ser válida: limpamos a escolha.
  useEffect(() => {
    const selected = categories.find((category) => category.id === getValues('categoryId'))
    if (selected && selected.tipo !== tipo) setValue('categoryId', '')
  }, [tipo, categories, getValues, setValue])

  const onSubmit = handleSubmit((values) =>
    run(() =>
      transaction ? update.mutateAsync({ id: transaction.id, values }) : create.mutateAsync(values),
    ),
  )

  const busy = isSubmitting || update.isPending || remove.isPending
  const missingSetup = categoryOptions.length === 0 || accountOptions.length === 0

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{transaction ? 'Editar transação' : 'Nova transação'}</DialogTitle>
        <DialogDescription>Registre uma receita ou uma despesa.</DialogDescription>
      </DialogHeader>

      {serverError && <FormAlert>{serverError}</FormAlert>}

      <SegmentedControl
        legend="Tipo"
        options={TIPOS.map((value) => ({ value, label: TIPO_LABELS[value].singular }))}
        {...register('tipo')}
      />

      <TextField
        id="transacao-valor"
        label="Valor"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,00"
        className="text-lg font-medium tabular-nums"
        hint={MONEY_EXAMPLE}
        error={errors.valor?.message}
        {...register('valor')}
      />

      <TextField
        id="transacao-descricao"
        label="Descrição (opcional)"
        autoComplete="off"
        maxLength={120}
        placeholder="Ex.: Supermercado"
        error={errors.descricao?.message}
        {...register('descricao')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="transacao-categoria"
          label="Categoria"
          placeholder="Escolha…"
          options={categoryOptions}
          error={errors.categoryId?.message}
          {...register('categoryId')}
        />
        <SelectField
          id="transacao-conta"
          label="Conta"
          placeholder="Escolha…"
          options={accountOptions}
          error={errors.accountId?.message}
          {...register('accountId')}
        />
      </div>

      {missingSetup && (
        <FormAlert>
          Precisas de pelo menos uma{' '}
          {accountOptions.length === 0 ? 'conta' : `categoria de ${tipo}`} ativa.{' '}
          <Link
            to={accountOptions.length === 0 ? '/configuracoes/contas' : '/configuracoes/categorias'}
            className="font-medium underline underline-offset-4"
          >
            Criar agora
          </Link>
        </FormAlert>
      )}

      <TextField
        id="transacao-data"
        label="Data"
        type="date"
        error={errors.data?.message}
        {...register('data')}
      />

      {transaction && (
        <ArchiveDeleteActions
          itemName={
            transaction.descricao ||
            categories.find((category) => category.id === transaction.category_id)?.nome ||
            'Transação'
          }
          disabled={busy}
          onDelete={() => run(() => remove.mutateAsync(transaction.id))}
        />
      )}

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" disabled={busy}>
          {isSubmitting ? 'Salvando…' : transaction ? 'Salvar' : 'Registrar'}
        </Button>
      </DialogFooter>
    </form>
  )
}
