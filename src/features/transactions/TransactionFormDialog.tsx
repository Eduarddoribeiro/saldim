import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { ArchiveDeleteActions } from '@/components/form/ArchiveDeleteActions'
import { FormAlert } from '@/components/form/FormAlert'
import { SegmentedControl } from '@/components/form/SegmentedControl'
import { TextField } from '@/components/form/TextField'
import { useServerAction } from '@/components/form/use-server-action'
import { SheetContent, SheetFooter } from '@/components/layout/SheetContent'
import { Button } from '@/components/ui/button'
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { isCreditCard, TIPO_CONTA_OPTIONS } from '@/features/accounts/account-options'
import type { Account } from '@/features/accounts/accounts-api'
import type { Category } from '@/features/categories/categories-api'
import { TIPO_LABELS, TIPOS } from '@/features/categories/schemas'
import { CategoryPicker } from '@/features/quick-entry/CategoryPicker'
import { ChoiceChips } from '@/features/quick-entry/ChoiceChips'
import { DateChips } from '@/features/quick-entry/DateChips'
import { rankByUsage, usageCounts } from '@/features/quick-entry/usage-ranking'
import { todayIso } from '@/lib/dates'
import { centsToInput } from '@/lib/money'
import {
  useBalanceMovements,
  useCreateTransaction,
  useDeleteTransaction,
  useUpdateTransaction,
} from './hooks'
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
      <SheetContent className="pb-0">
        {props.open && <TransactionForm key={props.transaction?.id ?? 'nova'} {...props} />}
      </SheetContent>
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
): T[] {
  return items
    .filter((item) => !item.arquivada || item.id === currentId)
    .map((item) => (item.arquivada ? { ...item, nome: `${item.nome} (arquivada)` } : item))
}

function TransactionForm({ onOpenChange, transaction, categories, accounts }: Props) {
  const { serverError, run } = useServerAction(() => onOpenChange(false))
  const create = useCreateTransaction()
  const update = useUpdateTransaction()
  const remove = useDeleteTransaction()
  const movements = useBalanceMovements()
  const today = todayIso()
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
          data: today,
          categoryId: '',
          accountId: firstActiveAccount?.id ?? '',
          descricao: '',
        },
  })

  const [tipo, categoryId] = useWatch({ control, name: ['tipo', 'categoryId'] })
  // Pelas mais usadas, como no lançamento rápido: a categoria certa costuma estar à vista
  const counts = useMemo(
    () => usageCounts(movements.data ?? [], (movement) => movement.category_id, { today }),
    [movements.data, today],
  )
  const categoryOptions = rankByUsage(
    selectable(
      categories.filter((category) => category.tipo === tipo),
      transaction?.category_id,
    ),
    counts,
  )
  // Cartões ficam de fora: as compras no cartão têm fatura e parcelas e um fluxo próprio (a base de
  // dados também o recusa — trigger transactions_check_cartao)
  const accountOptions = selectable(
    accounts.filter((account) => !isCreditCard(account)),
    transaction?.account_id,
  ).map((account) => ({
    value: account.id,
    label: account.nome,
    icon: TIPO_CONTA_OPTIONS[account.tipo].icon,
  }))

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
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold">
          {transaction ? 'Editar transação' : 'Nova transação'}
        </DialogTitle>
        <DialogDescription>
          {transaction
            ? 'As mudanças entram no saldo e nos relatórios do mês.'
            : 'Dinheiro que entrou ou saiu de uma conta.'}
        </DialogDescription>
      </DialogHeader>

      {serverError && <FormAlert>{serverError}</FormAlert>}

      <SegmentedControl
        legend="Tipo"
        className="[&>legend]:sr-only"
        options={TIPOS.map((value) => ({ value, label: TIPO_LABELS[value].singular }))}
        {...register('tipo')}
      />

      <TextField
        id="transacao-valor"
        label="Valor"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,00"
        className="h-16 text-center text-4xl font-semibold tracking-tight tabular-nums md:text-4xl"
        error={errors.valor?.message}
        {...register('valor')}
      />

      {missingSetup ? (
        <FormAlert>
          {accountOptions.length === 0
            ? 'Para registrar, você precisa de uma conta ativa.'
            : `Nenhuma categoria de ${tipo} ativa.`}{' '}
          <Link
            to={accountOptions.length === 0 ? '/configuracoes/contas' : '/configuracoes/categorias'}
            className="font-medium underline underline-offset-4"
          >
            {accountOptions.length === 0 ? 'Criar conta' : 'Criar categoria'}
          </Link>
        </FormAlert>
      ) : (
        <>
          <CategoryPicker
            categories={categoryOptions}
            selectedId={categoryId}
            error={errors.categoryId?.message}
            {...register('categoryId')}
          />
          <ChoiceChips
            legend={tipo === 'receita' ? 'Receber em' : 'Pagar com'}
            options={accountOptions}
            error={errors.accountId?.message}
            errorId="transacao-conta-erro"
            {...register('accountId')}
          />
        </>
      )}

      <DateChips
        name="transacao-data-escolha"
        fieldId="transacao-data"
        today={today}
        initial={getValues('data')}
        setDate={(date) => setValue('data', date)}
        field={register('data')}
        error={errors.data?.message}
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

      {transaction && (
        <ArchiveDeleteActions
          itemName={
            transaction.descricao ||
            categories.find((category) => category.id === transaction.category_id)?.nome ||
            'Transação'
          }
          disabled={busy}
          deleteHint="O saldo da conta e os relatórios do mês são recalculados sem ela."
          onDelete={() => run(() => remove.mutateAsync(transaction.id))}
        />
      )}

      <SheetFooter>
        <Button
          type="submit"
          size="lg"
          className="h-12 w-full rounded-full text-base"
          disabled={busy || missingSetup}
        >
          {isSubmitting ? 'Salvando…' : transaction ? 'Salvar' : `Registrar ${tipo}`}
        </Button>
      </SheetFooter>
    </form>
  )
}
