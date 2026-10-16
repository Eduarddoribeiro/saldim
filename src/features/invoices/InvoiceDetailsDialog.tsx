import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { ConfirmDeleteButton } from '@/components/form/ConfirmDeleteButton'
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
import type { CardPurchase } from '@/features/card-purchases/purchases-api'
import type { Category } from '@/features/categories/categories-api'
import { useCurrency } from '@/features/profile/hooks'
import type { InvoiceItem } from '@/features/transactions/transactions-api'
import type { InvoicePayment } from '@/features/transfers/transfers-api'
import { todayIso } from '@/lib/dates'
import { centsToInput, formatMoney } from '@/lib/money'
import { MONEY_EXAMPLE } from '@/lib/money-schema'
import { cn } from '@/lib/utils'
import { useCreatePayment, useDeletePayment } from './hooks'
import {
  INVOICE_STATE_CLASSES,
  INVOICE_STATE_LABELS,
  invoiceTitle,
  shortDate,
} from './invoice-options'
import type { InvoiceSummary } from './invoice-summary'
import type { Invoice } from './invoices-api'
import { paymentFormSchema, type PaymentFormInput, type PaymentFormValues } from './schemas'

export type InvoiceView = InvoiceSummary<Invoice, InvoiceItem, InvoicePayment>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: InvoiceView | null
  card: Account | undefined
  accounts: Account[]
  categories: Category[]
  purchases: CardPurchase[]
}

export function InvoiceDetailsDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md">
        {props.open && props.invoice && (
          <InvoiceDetails key={props.invoice.id} {...props} invoice={props.invoice} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function InvoiceDetails(props: Props & { invoice: InvoiceView }) {
  const [paying, setPaying] = useState(false)
  return paying ? (
    <PaymentForm {...props} onBack={() => setPaying(false)} />
  ) : (
    <Summary {...props} onPay={() => setPaying(true)} />
  )
}

function Summary({
  onOpenChange,
  invoice,
  card,
  accounts,
  categories,
  purchases,
  onPay,
}: Props & { invoice: InvoiceView; onPay: () => void }) {
  const currency = useCurrency()
  const money = (cents: number) => formatMoney(cents, currency)
  const accountsById = new Map(accounts.map((account) => [account.id, account]))
  const categoriesById = new Map(categories.map((category) => [category.id, category]))
  const purchasesById = new Map(purchases.map((purchase) => [purchase.id, purchase]))
  const { serverError, run } = useServerAction(() => {})
  const remove = useDeletePayment()
  const compras = invoice.parcelas.filter((item) => item.tipo !== 'estorno')
  const estornos = invoice.parcelas.filter((item) => item.tipo === 'estorno')
  const itemName = (item: InvoiceItem) =>
    item.descricao || categoriesById.get(item.category_id)?.nome || 'Compra'

  const details: [string, string][] = [
    ['Fechamento', shortDate(invoice.data_fechamento)],
    ['Vencimento', shortDate(invoice.data_vencimento)],
    ['Total', money(invoice.totalCentavos)],
    ['Pago', money(invoice.pagoCentavos)],
    invoice.emAbertoCentavos < 0
      ? ['Crédito', money(-invoice.emAbertoCentavos)]
      : ['Em aberto', money(invoice.emAbertoCentavos)],
  ]

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{invoiceTitle(invoice.mes_referencia)}</DialogTitle>
        <DialogDescription>{card?.nome ?? 'Cartão'}</DialogDescription>
      </DialogHeader>

      {serverError && <FormAlert>{serverError}</FormAlert>}

      <p>
        <span
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-medium',
            INVOICE_STATE_CLASSES[invoice.estado],
          )}
        >
          {INVOICE_STATE_LABELS[invoice.estado]}
        </span>
      </p>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {details.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="text-right font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="fatura-compras" className="grid gap-1.5">
        <h3 id="fatura-compras" className="text-sm font-medium">
          Compras ({compras.length})
        </h3>
        {compras.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma compra nesta fatura.</p>
        ) : (
          <ul aria-label="Compras da fatura" className="divide-y rounded-lg border text-sm">
            {compras.map((item) => {
              const purchase = item.compra_id ? purchasesById.get(item.compra_id) : undefined
              return (
                <li key={item.id} className="flex items-baseline justify-between gap-3 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate">{itemName(item)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {shortDate(item.data)}
                      {purchase && purchase.parcelas > 1
                        ? ` · parcela ${item.parcela_numero}/${purchase.parcelas}`
                        : ''}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{money(item.valor_centavos)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {estornos.length > 0 && (
        <section aria-labelledby="fatura-estornos" className="grid gap-1.5">
          <h3 id="fatura-estornos" className="text-sm font-medium">
            Estornos ({estornos.length})
          </h3>
          <ul aria-label="Estornos da fatura" className="divide-y rounded-lg border text-sm">
            {estornos.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate">{itemName(item)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {shortDate(item.data)} · estorno
                  </span>
                </span>
                <span className="shrink-0 text-emerald-700 tabular-nums dark:text-emerald-400">
                  {money(-item.valor_centavos)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="fatura-pagamentos" className="grid gap-1.5">
        <h3 id="fatura-pagamentos" className="text-sm font-medium">
          Pagamentos ({invoice.pagamentos.length})
        </h3>
        {invoice.pagamentos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ainda sem pagamentos.</p>
        ) : (
          <ul aria-label="Pagamentos da fatura" className="divide-y rounded-lg border text-sm">
            {invoice.pagamentos.map((payment) => (
              <li key={payment.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                <span className="min-w-0">
                  <span className="block truncate">
                    {accountsById.get(payment.conta_origem_id)?.nome ?? 'Conta'}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {shortDate(payment.data)}
                    {payment.descricao ? ` · ${payment.descricao}` : ''}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="tabular-nums">{money(payment.valor_centavos)}</span>
                  <ConfirmDeleteButton
                    what={`o pagamento de ${money(payment.valor_centavos)} de ${shortDate(payment.data)}`}
                    consequence="O dinheiro volta a contar na conta de origem e a fatura fica outra vez em aberto."
                    disabled={remove.isPending}
                    onConfirm={() => run(() => remove.mutateAsync(payment.id))}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
          Fechar
        </Button>
        {invoice.totalCentavos > 0 && invoice.emAbertoCentavos > 0 && (
          <Button type="button" size="lg" onClick={onPay}>
            Pagar fatura
          </Button>
        )}
      </DialogFooter>
    </div>
  )
}

function PaymentForm({
  onOpenChange,
  invoice,
  card,
  accounts,
  onBack,
}: Props & { invoice: InvoiceView; onBack: () => void }) {
  const currency = useCurrency()
  const { serverError, run } = useServerAction(() => onOpenChange(false))
  const create = useCreatePayment()
  // Sai de uma conta de dinheiro ativa; sugere a conta de pagamento configurada no cartão
  const sources = accounts.filter((account) => !isCreditCard(account) && !account.arquivada)
  const suggested = sources.find((account) => account.id === card?.conta_pagamento_id)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormInput, unknown, PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      contaOrigemId: suggested?.id ?? sources[0]?.id ?? '',
      valor: centsToInput(invoice.emAbertoCentavos),
      data: todayIso(),
      descricao: '',
    },
  })

  const onSubmit = handleSubmit((values) =>
    run(() =>
      create.mutateAsync({
        faturaId: invoice.id,
        cartaoId: invoice.account_id,
        contaOrigemId: values.contaOrigemId,
        valor: values.valor,
        data: values.data,
        descricao: values.descricao,
      }),
    ),
  )

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Pagar {invoiceTitle(invoice.mes_referencia).toLowerCase()}</DialogTitle>
        <DialogDescription>
          {card?.nome ?? 'Cartão'} · em aberto {formatMoney(invoice.emAbertoCentavos, currency)}. O
          pagamento não é uma despesa: o dinheiro passa da conta para o cartão.
        </DialogDescription>
      </DialogHeader>

      {serverError && <FormAlert>{serverError}</FormAlert>}

      <SelectField
        id="pagamento-conta"
        label="Pagar a partir de"
        placeholder="Escolhe a conta…"
        options={sources.map((account) => ({ value: account.id, label: account.nome }))}
        error={errors.contaOrigemId?.message}
        {...register('contaOrigemId')}
      />

      <TextField
        id="pagamento-valor"
        label="Valor"
        inputMode="decimal"
        autoComplete="off"
        className="text-lg font-medium tabular-nums"
        hint={`Pode ser parcial. ${MONEY_EXAMPLE}`}
        error={errors.valor?.message}
        {...register('valor')}
      />

      <div className="grid items-start gap-4 sm:grid-cols-2">
        <TextField
          id="pagamento-data"
          label="Data"
          type="date"
          max={todayIso()}
          error={errors.data?.message}
          {...register('data')}
        />
        <TextField
          id="pagamento-descricao"
          label="Descrição (opcional)"
          autoComplete="off"
          maxLength={120}
          error={errors.descricao?.message}
          {...register('descricao')}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={onBack}>
          Voltar
        </Button>
        <Button type="submit" size="lg" disabled={isSubmitting || create.isPending}>
          {isSubmitting ? 'A registar…' : 'Registar pagamento'}
        </Button>
      </DialogFooter>
    </form>
  )
}
