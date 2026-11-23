import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { FormAlert } from '@/components/form/FormAlert'
import { SegmentedControl } from '@/components/form/SegmentedControl'
import { SelectField } from '@/components/form/SelectField'
import { TextField } from '@/components/form/TextField'
import { useServerAction } from '@/components/form/use-server-action'
import { Button } from '@/components/ui/button'
import { SheetContent, SheetFooter } from '@/components/layout/SheetContent'
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { isCreditCard, TIPO_CONTA_OPTIONS } from '@/features/accounts/account-options'
import type { Account } from '@/features/accounts/accounts-api'
import { useAccounts } from '@/features/accounts/hooks'
import { useRegisterPurchase, useRegisterSplitPurchase } from '@/features/card-purchases/hooks'
import { InstallmentPreview, type PreviewInput } from '@/features/card-purchases/InstallmentPreview'
import { NEW_PERSON } from '@/features/card-purchases/schemas'
import type { Category } from '@/features/categories/categories-api'
import { useCategories } from '@/features/categories/hooks'
import { TIPO_LABELS, TIPOS } from '@/features/categories/schemas'
import { useCreatePerson, usePeople } from '@/features/people/hooks'
import { useCurrency } from '@/features/profile/hooks'
import { useBalanceMovements, useCreateTransaction } from '@/features/transactions/hooks'
import { todayIso } from '@/lib/dates'
import { halfSplit } from '@/lib/credit-card'
import { centsToInput, formatMoney, parseMoney } from '@/lib/money'
import { CategoryPicker } from './CategoryPicker'
import { ChoiceChips } from './ChoiceChips'
import { DateChips } from './DateChips'
import { ParcelasStepper } from './ParcelasStepper'
import type { QuickEntryOptions } from './quick-entry-context'
import { quickEntrySchema, type QuickEntryInput, type QuickEntryValues } from './schema'
import { rankByUsage, usageCounts } from './usage-ranking'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  options: QuickEntryOptions
}

/**
 * Lançamento rápido (docs/features/lancamento-rapido.md): no telemóvel é uma folha que sobe de baixo
 * com o botão Registrar sempre visível; no desktop, um diálogo. Só cria — editar continua nos
 * diálogos de cada transação ou compra.
 */
export function QuickEntrySheet({ open, onOpenChange, options }: Props) {
  const valorRef = useRef<HTMLInputElement | null>(null)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent initialFocus={valorRef} className="pb-0">
        {open && (
          <QuickEntryForm onOpenChange={onOpenChange} options={options} valorRef={valorRef} />
        )}
      </SheetContent>
    </Dialog>
  )
}

const today = () => todayIso()

function QuickEntryForm({
  onOpenChange,
  options,
  valorRef,
}: Omit<Props, 'open'> & { valorRef: React.RefObject<HTMLInputElement | null> }) {
  const categories = useCategories()
  const accounts = useAccounts()
  const movements = useBalanceMovements()

  if (categories.isPending || accounts.isPending) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Novo lançamento</DialogTitle>
        </DialogHeader>
        <p role="status" className="pb-6 text-sm text-muted-foreground">
          Carregando…
        </p>
      </>
    )
  }
  return (
    <LoadedForm
      onOpenChange={onOpenChange}
      options={options}
      valorRef={valorRef}
      categories={categories.data ?? []}
      accounts={accounts.data ?? []}
      movements={movements.data ?? []}
    />
  )
}

function LoadedForm({
  onOpenChange,
  options,
  valorRef,
  categories,
  accounts,
  movements,
}: Omit<Props, 'open'> & {
  valorRef: React.RefObject<HTMLInputElement | null>
  categories: Category[]
  accounts: Account[]
  movements: { account_id: string; category_id: string; data: string }[]
}) {
  const currency = useCurrency()
  const people = usePeople()
  const activePeople = useMemo(
    () => (people.data ?? []).filter((person) => !person.arquivada),
    [people.data],
  )
  const createTransaction = useCreateTransaction()
  const registerPurchase = useRegisterPurchase()
  const registerSplit = useRegisterSplitPurchase()
  const createPerson = useCreatePerson()
  const { serverError, run } = useServerAction(() => onOpenChange(false))

  const now = today()
  const categoryCounts = useMemo(
    () => usageCounts(movements, (movement) => movement.category_id, { today: now }),
    [movements, now],
  )
  const accountCounts = useMemo(
    () => usageCounts(movements, (movement) => movement.account_id, { today: now }),
    [movements, now],
  )
  const active = accounts.filter((account) => !account.arquivada)
  const moneyAccounts = rankByUsage(
    active.filter((account) => !isCreditCard(account)),
    accountCounts,
  )
  const cards = rankByUsage(active.filter(isCreditCard), accountCounts)
  const cardIds = useMemo(
    () => new Set(accounts.filter(isCreditCard).map((account) => account.id)),
    [accounts],
  )
  // Regra 5: abre na conta de dinheiro mais usada; o cartão é um toque (ou o atalho "Cartão")
  const defaultAccount = (options.card ? cards[0] : undefined) ?? moneyAccounts[0]

  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<QuickEntryInput, unknown, QuickEntryValues>({
    resolver: zodResolver(quickEntrySchema(cardIds)),
    defaultValues: {
      tipo: options.card ? 'despesa' : (options.tipo ?? 'despesa'),
      valor: '',
      data: now,
      categoryId: '',
      accountId: defaultAccount?.id ?? '',
      descricao: '',
      parcelas: '1',
      emCurso: false,
      parcelaInicial: '2',
      pessoaId: '',
      novaPessoa: '',
      divisao: 'minha',
      partePessoa: '',
    },
  })

  const [tipo, accountId, categoryId, valor, data, parcelasText, emCurso, parcelaInicialText] =
    useWatch({
      control,
      name: [
        'tipo',
        'accountId',
        'categoryId',
        'valor',
        'data',
        'parcelas',
        'emCurso',
        'parcelaInicial',
      ],
    })
  const [pessoaId, divisao, partePessoa, novaPessoa] = useWatch({
    control,
    name: ['pessoaId', 'divisao', 'partePessoa', 'novaPessoa'],
  })
  const card = cards.find((account) => account.id === accountId)
  const parcelas = Number(parcelasText)

  // Receita não usa cartões: se estava num cartão, volta à conta de dinheiro mais usada
  useEffect(() => {
    if (tipo === 'receita' && cardIds.has(getValues('accountId'))) {
      setValue('accountId', moneyAccounts[0]?.id ?? '')
    }
  }, [tipo, cardIds, moneyAccounts, getValues, setValue])

  // Ao trocar Despesa ↔ Receita, a categoria do outro tipo deixa de valer
  useEffect(() => {
    const selected = categories.find((category) => category.id === getValues('categoryId'))
    if (selected && selected.tipo !== tipo) setValue('categoryId', '')
  }, [tipo, categories, getValues, setValue])

  const categoryOptions = rankByUsage(
    categories.filter((category) => category.tipo === tipo && !category.arquivada),
    categoryCounts,
  )
  const accountOptions = (tipo === 'despesa' ? [...moneyAccounts, ...cards] : moneyAccounts).map(
    (account) => ({
      value: account.id,
      label: account.nome,
      icon: TIPO_CONTA_OPTIONS[account.tipo].icon,
    }),
  )

  const total = parseMoney(valor)
  // Compra dividida: a parte da pessoa vem com a metade certa (halfSplit) até ser mudada à mão
  const [shareEdited, setShareEdited] = useState(false)
  const halfForPerson =
    total !== null && Number.isInteger(parcelas) && total >= 2 * parcelas
      ? halfSplit(total, parcelas).pessoa
      : null
  useEffect(() => {
    if (divisao === 'dividida' && !shareEdited) {
      setValue('partePessoa', halfForPerson !== null ? centsToInput(halfForPerson) : '')
    }
  }, [divisao, shareEdited, halfForPerson, setValue])
  // Ao passar para "De outra pessoa" ou "Dividida", já escolhe a primeira pessoa (normalmente a única)
  useEffect(() => {
    if (divisao !== 'minha' && !getValues('pessoaId') && activePeople[0]) {
      setValue('pessoaId', activePeople[0].id)
    }
  }, [divisao, activePeople, getValues, setValue])
  const parteCents = parseMoney(partePessoa)
  const myShare = total !== null && parteCents !== null ? total - parteCents : null
  const previewInput: PreviewInput | null =
    card?.dia_fechamento && card.dia_vencimento && total !== null && total > 0
      ? {
          accountId: card.id,
          config: { diaFechamento: card.dia_fechamento, diaVencimento: card.dia_vencimento },
          dataCompra: data,
          totalCentavos: total,
          numeroParcelas: parcelas,
          parcelaInicial: emCurso ? Number(parcelaInicialText) : 1,
        }
      : null

  const personOptions = [
    ...activePeople.map((person) => ({ value: person.id, label: person.nome })),
    { value: NEW_PERSON, label: 'Outra pessoa…' },
  ]
  const personLabel =
    (activePeople.find((person) => person.id === pessoaId)?.nome ??
      (pessoaId === NEW_PERSON && novaPessoa.trim())) ||
    'outra pessoa'

  const onSubmit = handleSubmit((result) =>
    run(async () => {
      if (result.kind === 'transaction') {
        await createTransaction.mutateAsync(result.values)
        return
      }
      const values = result.values
      const pessoa =
        values.pessoaId === NEW_PERSON
          ? (await createPerson.mutateAsync(values.novaPessoa)).id
          : values.pessoaId
      if (result.kind === 'split') {
        await registerSplit.mutateAsync({
          ...values,
          pessoaId: pessoa,
          valorPessoa: result.valorPessoa,
        })
        return
      }
      await registerPurchase.mutateAsync({ ...values, pessoaId: pessoa })
    }),
  )

  const busy =
    isSubmitting ||
    createTransaction.isPending ||
    registerPurchase.isPending ||
    registerSplit.isPending ||
    createPerson.isPending
  const valorField = register('valor')
  const missingAccount = accountOptions.length === 0
  const missingCategory = categoryOptions.length === 0

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold">Novo lançamento</DialogTitle>
      </DialogHeader>

      {serverError && <FormAlert>{serverError}</FormAlert>}

      <SegmentedControl
        legend="Tipo"
        className="[&>legend]:sr-only"
        options={TIPOS.map((value) => ({ value, label: TIPO_LABELS[value].singular }))}
        {...register('tipo')}
      />

      <TextField
        id="lancamento-valor"
        label={card ? 'Valor total' : 'Valor'}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,00"
        className="h-16 text-center text-4xl font-semibold tracking-tight tabular-nums md:text-4xl"
        error={errors.valor?.message}
        {...valorField}
        ref={(element) => {
          valorField.ref(element)
          valorRef.current = element
        }}
      />

      {missingCategory ? (
        <FormAlert>
          Nenhuma categoria de {tipo} ativa.{' '}
          <Link
            to="/configuracoes/categorias"
            onClick={() => onOpenChange(false)}
            className="font-medium underline underline-offset-4"
          >
            Criar categoria
          </Link>
        </FormAlert>
      ) : (
        <CategoryPicker
          categories={categoryOptions}
          selectedId={categoryId}
          error={errors.categoryId?.message}
          {...register('categoryId')}
        />
      )}

      {missingAccount ? (
        <FormAlert>
          Para registrar, você precisa de uma conta ativa.{' '}
          <Link
            to="/configuracoes/contas"
            onClick={() => onOpenChange(false)}
            className="font-medium underline underline-offset-4"
          >
            Criar conta
          </Link>
        </FormAlert>
      ) : (
        <ChoiceChips
          legend={tipo === 'receita' ? 'Receber em' : 'Pagar com'}
          options={accountOptions}
          error={errors.accountId?.message}
          errorId="lancamento-conta-erro"
          {...register('accountId')}
        />
      )}

      {card && (
        <div className="grid gap-4 rounded-2xl bg-muted/60 p-4">
          <ParcelasStepper
            value={parcelas}
            error={errors.parcelas?.message}
            onChange={(value) => {
              setValue('parcelas', String(value))
              if (Number(getValues('parcelaInicial')) > value && value >= 2) {
                setValue('parcelaInicial', String(value))
              }
            }}
          />
          <ChoiceChips
            legend="De quem é a compra?"
            options={[
              { value: 'minha', label: 'Minha' },
              { value: 'pessoa', label: 'De outra pessoa' },
              { value: 'dividida', label: 'Dividida' },
            ]}
            {...register('divisao')}
          />
          {divisao !== 'minha' && (
            <SelectField
              id="lancamento-pessoa"
              label={divisao === 'dividida' ? 'Dividida com' : 'De quem?'}
              placeholder="Escolha…"
              options={personOptions}
              error={errors.pessoaId?.message}
              hint={
                divisao === 'pessoa'
                  ? 'Conta na fatura e no limite, mas não nos seus gastos: vai para A receber.'
                  : undefined
              }
              {...register('pessoaId')}
            />
          )}
          {divisao !== 'minha' && pessoaId === NEW_PERSON && (
            <TextField
              id="lancamento-nova-pessoa"
              label="Nome da pessoa"
              autoComplete="off"
              maxLength={60}
              placeholder="Ex.: Mãe"
              error={errors.novaPessoa?.message}
              {...register('novaPessoa')}
            />
          )}
          {divisao === 'dividida' && (
            <TextField
              id="lancamento-parte-pessoa"
              label={`Parte de ${personLabel}`}
              inputMode="decimal"
              autoComplete="off"
              className="tabular-nums"
              hint={
                myShare !== null
                  ? `Sua parte: ${formatMoney(myShare, currency)}. Já vem a metade certa para cada parcela bater com o banco.`
                  : 'Já vem a metade certa para cada parcela bater com o banco.'
              }
              error={errors.partePessoa?.message}
              {...register('partePessoa', { onChange: () => setShareEdited(true) })}
            />
          )}
          {parcelas >= 2 && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                {...register('emCurso')}
              />
              <span>
                Compra já em andamento
                <span className="block text-xs text-muted-foreground">
                  Marque se você começou a usar o app no meio das parcelas: só as que faltam são
                  registradas.
                </span>
              </span>
            </label>
          )}
          {parcelas >= 2 && emCurso && (
            <SelectField
              id="lancamento-parcela-inicial"
              label="Primeira parcela a pagar"
              options={Array.from({ length: parcelas - 1 }, (_, index) => index + 2).map((n) => ({
                value: String(n),
                label: `${n}.ª de ${parcelas}`,
              }))}
              error={errors.parcelaInicial?.message}
              {...register('parcelaInicial')}
            />
          )}
          <InstallmentPreview input={previewInput} currency={currency} />
        </div>
      )}

      <DateChips
        legend={card ? 'Data da compra' : 'Data'}
        name="lancamento-data-escolha"
        fieldId="lancamento-data"
        today={now}
        initial={now}
        setDate={(date) => setValue('data', date)}
        field={register('data')}
        error={errors.data?.message}
      />

      <TextField
        id="lancamento-descricao"
        label="Descrição (opcional)"
        autoComplete="off"
        maxLength={120}
        placeholder={card ? 'Ex.: Televisão' : 'Ex.: Supermercado'}
        error={errors.descricao?.message}
        {...register('descricao')}
      />

      <SheetFooter>
        <Button
          type="submit"
          size="lg"
          className="h-12 w-full rounded-full text-base"
          disabled={busy || missingAccount || missingCategory}
        >
          {isSubmitting ? 'Registrando…' : card ? 'Registrar compra' : `Registrar ${tipo}`}
        </Button>
      </SheetFooter>
    </form>
  )
}
