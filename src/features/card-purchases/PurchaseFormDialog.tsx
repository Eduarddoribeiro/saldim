import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
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
import type { Category } from '@/features/categories/categories-api'
import { useCreatePerson, usePeople } from '@/features/people/hooks'
import { useCurrency } from '@/features/profile/hooks'
import { MAX_PARCELAS } from '@/lib/credit-card'
import { todayIso } from '@/lib/dates'
import { parseMoney } from '@/lib/money'
import { MONEY_EXAMPLE } from '@/lib/money-schema'
import { useRegisterPurchase } from './hooks'
import { InstallmentPreview, type PreviewInput } from './InstallmentPreview'
import {
  NEW_PERSON,
  purchaseFormSchema,
  type PurchaseFormInput,
  type PurchaseFormValues,
} from './schemas'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  accounts: Account[]
}

export function PurchaseFormDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md">
        {props.open && <PurchaseForm {...props} />}
      </DialogContent>
    </Dialog>
  )
}

const range = (from: number, to: number) =>
  Array.from({ length: Math.max(0, to - from + 1) }, (_, index) => from + index)

const PARCELAS_OPTIONS = range(1, MAX_PARCELAS).map((n) => ({
  value: String(n),
  label: n === 1 ? '1× (à vista)' : `${n}×`,
}))

function PurchaseForm({ onOpenChange, categories, accounts }: Props) {
  const currency = useCurrency()
  const { serverError, run } = useServerAction(() => onOpenChange(false))
  const registerPurchase = useRegisterPurchase()
  const createPerson = useCreatePerson()
  const people = usePeople()
  const cards = accounts.filter((account) => isCreditCard(account) && !account.arquivada)

  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseFormInput, unknown, PurchaseFormValues>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: {
      cardId: cards.length === 1 ? cards[0].id : '',
      valor: '',
      parcelas: '1',
      data: todayIso(),
      categoryId: '',
      descricao: '',
      emCurso: false,
      parcelaInicial: '2',
      pessoaId: '',
      novaPessoa: '',
    },
  })

  const [cardId, valor, parcelasText, data, emCurso, parcelaInicialText, pessoaId] = useWatch({
    control,
    name: ['cardId', 'valor', 'parcelas', 'data', 'emCurso', 'parcelaInicial', 'pessoaId'],
  })
  const parcelas = Number(parcelasText)
  const card = cards.find((account) => account.id === cardId)

  // Ao reduzir as parcelas, a parcela inicial de uma compra em curso pode deixar de existir.
  useEffect(() => {
    if (Number(getValues('parcelaInicial')) > parcelas && parcelas >= 2) {
      setValue('parcelaInicial', String(parcelas))
    }
  }, [parcelas, getValues, setValue])

  const total = parseMoney(valor)
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

  const categoryOptions = categories
    .filter((category) => category.tipo === 'despesa' && !category.arquivada)
    .map((category) => ({ value: category.id, label: category.nome }))

  // T1: "Minha", as pessoas ativas e "Outra pessoa…" (cria a pessoa ao registar)
  const personOptions = [
    { value: '', label: 'Minha' },
    ...(people.data ?? [])
      .filter((person) => !person.arquivada)
      .map((person) => ({ value: person.id, label: person.nome })),
    { value: NEW_PERSON, label: 'Outra pessoa…' },
  ]

  const onSubmit = handleSubmit((values) =>
    run(async () => {
      const pessoaId =
        values.pessoaId === NEW_PERSON
          ? (await createPerson.mutateAsync(values.novaPessoa)).id
          : values.pessoaId
      await registerPurchase.mutateAsync({ ...values, pessoaId })
    }),
  )
  const busy = isSubmitting || registerPurchase.isPending || createPerson.isPending

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Compra no cartão</DialogTitle>
        <DialogDescription>Cada parcela entra na fatura do mês em que vence.</DialogDescription>
      </DialogHeader>

      {serverError && <FormAlert>{serverError}</FormAlert>}

      <SelectField
        id="compra-cartao"
        label="Cartão"
        placeholder="Escolha o cartão…"
        options={cards.map((account) => ({ value: account.id, label: account.nome }))}
        error={errors.cardId?.message}
        {...register('cardId')}
      />

      <div className="grid items-start gap-4 sm:grid-cols-[1fr_10rem]">
        <TextField
          id="compra-valor"
          label="Valor total"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          className="text-lg font-medium tabular-nums"
          hint={MONEY_EXAMPLE}
          error={errors.valor?.message}
          {...register('valor')}
        />
        <SelectField
          id="compra-parcelas"
          label="Número de parcelas"
          options={PARCELAS_OPTIONS}
          error={errors.parcelas?.message}
          {...register('parcelas')}
        />
      </div>

      <SelectField
        id="compra-pessoa"
        label="De quem é a compra?"
        options={personOptions}
        hint={
          pessoaId
            ? 'Conta na fatura e no limite, mas não nos seus gastos: vai para A receber.'
            : undefined
        }
        {...register('pessoaId')}
      />
      {pessoaId === NEW_PERSON && (
        <TextField
          id="compra-nova-pessoa"
          label="Nome da pessoa"
          autoComplete="off"
          maxLength={60}
          placeholder="Ex.: Mãe"
          error={errors.novaPessoa?.message}
          {...register('novaPessoa')}
        />
      )}

      <TextField
        id="compra-descricao"
        label="Descrição (opcional)"
        autoComplete="off"
        maxLength={120}
        placeholder="Ex.: Televisão"
        error={errors.descricao?.message}
        {...register('descricao')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="compra-categoria"
          label="Categoria"
          placeholder="Escolha…"
          options={categoryOptions}
          error={errors.categoryId?.message}
          {...register('categoryId')}
        />
        <TextField
          id="compra-data"
          label="Data da compra"
          type="date"
          error={errors.data?.message}
          {...register('data')}
        />
      </div>

      {parcelas >= 2 && (
        <div className="grid gap-3 rounded-lg border p-3">
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
          {emCurso && (
            <SelectField
              id="compra-parcela-inicial"
              label="Primeira parcela a pagar"
              options={range(2, parcelas).map((n) => ({
                value: String(n),
                label: `${n}.ª de ${parcelas}`,
              }))}
              error={errors.parcelaInicial?.message}
              {...register('parcelaInicial')}
            />
          )}
        </div>
      )}

      <InstallmentPreview input={previewInput} currency={currency} />

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" disabled={busy || cards.length === 0}>
          {isSubmitting ? 'Registrando…' : 'Registrar compra'}
        </Button>
      </DialogFooter>
    </form>
  )
}
