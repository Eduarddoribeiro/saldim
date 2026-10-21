import { zodResolver } from '@hookform/resolvers/zod'
import { Pause, Play } from 'lucide-react'
import { useEffect, useMemo } from 'react'
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
import { dayOf, nextOnOrAfter } from '@/lib/recurrence'
import { useCreateRecurring, useDeleteRecurring, useUpdateRecurring } from './hooks'
import type { Recurring } from './recurring-api'
import { describeSchedule, FREQUENCY_OPTIONS } from './recurring-options'
import { recurringFormSchema, type RecurringFormInput, type RecurringFormOutput } from './schemas'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Recorrência a editar; sem ela, o diálogo cria uma nova. */
  recurring?: Recurring | null
  categories: Category[]
  accounts: Account[]
}

export function RecurringFormDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md">
        {props.open && <RecurringForm key={props.recurring?.id ?? 'nova'} {...props} />}
      </DialogContent>
    </Dialog>
  )
}

/** Só as ativas, mais a que já estiver escolhida (pode ter sido arquivada entretanto). */
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

function RecurringForm({ onOpenChange, recurring, categories, accounts }: Props) {
  const { serverError, run } = useServerAction(() => onOpenChange(false))
  const create = useCreateRecurring()
  const update = useUpdateRecurring()
  const remove = useDeleteRecurring()
  const today = todayIso()
  const schema = useMemo(() => recurringFormSchema(today), [today])

  // Uma recorrência pausada pode ter a próxima data no passado: o formulário propõe a seguinte
  const initialDate = recurring
    ? nextOnOrAfter(recurring.proxima_data, recurring.frequencia, recurring.dia, today)
    : today

  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RecurringFormInput, unknown, RecurringFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: recurring
      ? {
          tipo: recurring.tipo,
          valor: centsToInput(recurring.valor_centavos),
          descricao: recurring.descricao,
          accountId: recurring.account_id,
          categoryId: recurring.category_id,
          frequencia: recurring.frequencia,
          proximaData: initialDate,
        }
      : {
          tipo: 'despesa',
          valor: '',
          descricao: '',
          accountId: '',
          categoryId: '',
          frequencia: 'mensal',
          proximaData: today,
        },
  })

  const [tipo, accountId, frequencia, proximaData] = useWatch({
    control,
    name: ['tipo', 'accountId', 'frequencia', 'proximaData'],
  })
  const categoryOptions = selectable(
    categories.filter((category) => category.tipo === tipo),
    recurring?.category_id,
  )
  // Receitas só em contas de dinheiro; despesas também em cartões (compra à vista na fatura da data)
  const accountOptions = selectable(
    accounts.filter((account) => tipo === 'despesa' || !isCreditCard(account)),
    recurring?.account_id,
  )
  const selectedAccount = accounts.find((account) => account.id === accountId)

  // Ao trocar Despesa ↔ Receita, a categoria (e um cartão, numa receita) deixa de ser válida
  useEffect(() => {
    const category = categories.find((item) => item.id === getValues('categoryId'))
    if (category && category.tipo !== tipo) setValue('categoryId', '')
    const account = accounts.find((item) => item.id === getValues('accountId'))
    if (account && tipo === 'receita' && isCreditCard(account)) setValue('accountId', '')
  }, [tipo, categories, accounts, getValues, setValue])

  // O dia pedido: o da data escolhida. Se a data não mudou, mantém o guardado (31 → 30/11 continua 31).
  const dayFor = (date: string) => (recurring && date === initialDate ? recurring.dia : dayOf(date))

  const onSubmit = handleSubmit((values) => {
    const row = {
      tipo: values.tipo,
      valorCentavos: values.valor,
      descricao: values.descricao,
      accountId: values.accountId,
      categoryId: values.categoryId,
      frequencia: values.frequencia,
      proximaData: values.proximaData,
      dia: dayFor(values.proximaData),
    }
    return run(() =>
      recurring
        ? update.mutateAsync({
            id: recurring.id,
            patch: {
              account_id: row.accountId,
              category_id: row.categoryId,
              tipo: row.tipo,
              valor_centavos: row.valorCentavos,
              descricao: row.descricao,
              frequencia: row.frequencia,
              dia: row.dia,
              proxima_data: row.proximaData,
            },
          })
        : create.mutateAsync(row),
    )
  })

  // Pausar guarda só o estado; retomar recomeça na próxima data a partir de hoje (D18: nada passado)
  const togglePause = () =>
    recurring &&
    run(() =>
      update.mutateAsync({
        id: recurring.id,
        patch: recurring.ativa
          ? { ativa: false }
          : { ativa: true, proxima_data: initialDate, dia: recurring.dia },
      }),
    )

  const busy = isSubmitting || create.isPending || update.isPending || remove.isPending
  const missingSetup = categoryOptions.length === 0 || accountOptions.length === 0
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(proximaData ?? '')

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{recurring ? 'Editar recorrente' : 'Novo recorrente'}</DialogTitle>
        <DialogDescription>
          Um lançamento que se repete. É criado sozinho quando chega o dia.
        </DialogDescription>
      </DialogHeader>

      {serverError && <FormAlert>{serverError}</FormAlert>}
      {recurring && !recurring.ativa && (
        <FormAlert variant="success">
          Está pausado: nenhum lançamento é criado até você retomar.
        </FormAlert>
      )}

      <SegmentedControl
        legend="Tipo"
        options={TIPOS.map((value) => ({ value, label: TIPO_LABELS[value].singular }))}
        {...register('tipo')}
      />

      <TextField
        id="recorrente-descricao"
        label="Nome"
        autoComplete="off"
        maxLength={120}
        placeholder="Ex.: Netflix"
        error={errors.descricao?.message}
        {...register('descricao')}
      />

      <TextField
        id="recorrente-valor"
        label="Valor"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,00"
        className="text-lg font-medium tabular-nums"
        hint={MONEY_EXAMPLE}
        error={errors.valor?.message}
        {...register('valor')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="recorrente-conta"
          label={tipo === 'despesa' ? 'Conta ou cartão' : 'Conta'}
          placeholder="Escolha…"
          options={accountOptions}
          error={errors.accountId?.message}
          {...register('accountId')}
        />
        <SelectField
          id="recorrente-categoria"
          label="Categoria"
          placeholder="Escolha…"
          options={categoryOptions}
          error={errors.categoryId?.message}
          {...register('categoryId')}
        />
      </div>
      {selectedAccount && isCreditCard(selectedAccount) && (
        <p className="-mt-2 text-xs text-muted-foreground">
          No cartão, cada lançamento é uma compra à vista e entra na fatura da sua data.
        </p>
      )}

      {missingSetup && (
        <FormAlert>
          {accountOptions.length === 0
            ? 'Para criar um recorrente, você precisa de uma conta ativa.'
            : `Nenhuma categoria de ${tipo} ativa.`}{' '}
          <Link
            to={accountOptions.length === 0 ? '/configuracoes/contas' : '/configuracoes/categorias'}
            className="font-medium underline underline-offset-4"
          >
            {accountOptions.length === 0 ? 'Criar conta' : 'Criar categoria'}
          </Link>
        </FormAlert>
      )}

      <SegmentedControl legend="Repete" options={FREQUENCY_OPTIONS} {...register('frequencia')} />

      <TextField
        id="recorrente-data"
        label="Próxima data"
        type="date"
        min={today}
        hint={
          validDate
            ? `${describeSchedule(frequencia, dayFor(proximaData), proximaData)}, a partir desta data.`
            : undefined
        }
        error={errors.proximaData?.message}
        {...register('proximaData')}
      />

      {recurring && (
        <div className="grid gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={togglePause}>
            {recurring.ativa ? <Pause aria-hidden /> : <Play aria-hidden />}
            {recurring.ativa ? 'Pausar' : 'Retomar'}
          </Button>
          <ArchiveDeleteActions
            itemName={recurring.descricao}
            disabled={busy}
            deleteHint="Os lançamentos já criados ficam nas transações."
            onDelete={() => run(() => remove.mutateAsync(recurring.id))}
          />
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" disabled={busy}>
          {isSubmitting ? 'Salvando…' : recurring ? 'Salvar' : 'Criar'}
        </Button>
      </DialogFooter>
    </form>
  )
}
