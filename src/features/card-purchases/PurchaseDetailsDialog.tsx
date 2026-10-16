import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { ArchiveDeleteActions } from '@/components/form/ArchiveDeleteActions'
import { ConfirmDeleteButton } from '@/components/form/ConfirmDeleteButton'
import { FormAlert } from '@/components/form/FormAlert'
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
import type { Account } from '@/features/accounts/accounts-api'
import type { Category } from '@/features/categories/categories-api'
import { useCurrency } from '@/features/profile/hooks'
import { formatDay, todayIso } from '@/lib/dates'
import { centsToInput, formatMoney } from '@/lib/money'
import { MONEY_EXAMPLE } from '@/lib/money-schema'
import { useDeletePurchase, useDeleteRefund, useRefunds, useRegisterRefund } from './hooks'
import { InstallmentPreview } from './InstallmentPreview'
import type { CardPurchase, Refund } from './purchases-api'
import { refundFormSchema, type RefundFormInput, type RefundFormValues } from './schemas'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  purchase: CardPurchase | null
  card: Account | undefined
  category: Category | undefined
}

/**
 * Detalhe de uma compra no cartão (abre-se a partir de qualquer parcela ou estorno). Uma compra não se
 * edita: se foi devolvida ou cancelada, regista-se um estorno (C8); se foi mal registada, apaga-se
 * (as parcelas e os estornos vão com ela) e regista-se de novo.
 */
export function PurchaseDetailsDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md">
        {props.open && props.purchase && (
          <PurchaseDetails key={props.purchase.id} {...props} purchase={props.purchase} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function PurchaseDetails(props: Props & { purchase: CardPurchase }) {
  const [refunding, setRefunding] = useState(false)
  const refunds = useRefunds()
  const own = (refunds.data ?? []).filter((refund) => refund.compra_id === props.purchase.id)
  const estornado = own.reduce((total, refund) => total + refund.valor_centavos, 0)
  const porEstornar = props.purchase.valor_total_centavos - estornado

  return refunding ? (
    <RefundForm {...props} porEstornar={porEstornar} onBack={() => setRefunding(false)} />
  ) : (
    <Summary
      {...props}
      refunds={own}
      refundsError={refunds.error}
      estornado={estornado}
      // Enquanto os estornos carregam, não se sabe quanto falta estornar
      porEstornar={refunds.data ? porEstornar : 0}
      onRefund={() => setRefunding(true)}
    />
  )
}

function Summary({
  onOpenChange,
  purchase,
  card,
  category,
  refunds,
  refundsError,
  estornado,
  porEstornar,
  onRefund,
}: Props & {
  purchase: CardPurchase
  refunds: Refund[]
  refundsError: Error | null
  estornado: number
  porEstornar: number
  onRefund: () => void
}) {
  const currency = useCurrency()
  const money = (cents: number) => formatMoney(cents, currency)
  const { serverError, run } = useServerAction(() => onOpenChange(false))
  const deleteRefund = useServerAction(() => {})
  const remove = useDeletePurchase()
  const removeRefund = useDeleteRefund()
  const name = purchase.descricao || category?.nome || 'Compra no cartão'
  const registadas = purchase.parcelas - purchase.parcela_inicial + 1

  const details: [string, string][] = [
    ['Cartão', card?.nome ?? '—'],
    ['Categoria', category?.nome ?? 'Sem categoria'],
    ['Data da compra', formatDay(purchase.data_compra)],
    ['Valor total', money(purchase.valor_total_centavos)],
    [
      'Parcelas',
      purchase.parcela_inicial > 1
        ? `${purchase.parcelas}× (registadas da ${purchase.parcela_inicial}.ª à ${purchase.parcelas}.ª)`
        : `${purchase.parcelas}×`,
    ],
  ]
  if (estornado > 0) details.push(['Estornado', money(estornado)])

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{name}</DialogTitle>
        <DialogDescription>
          Compra no cartão. Se foi devolvida ou cancelada, regista um estorno; se te enganaste a
          registá-la, apaga-a e regista-a de novo.
        </DialogDescription>
      </DialogHeader>

      {serverError && <FormAlert>{serverError}</FormAlert>}
      {deleteRefund.serverError && <FormAlert>{deleteRefund.serverError}</FormAlert>}
      {refundsError && <FormAlert>Não foi possível carregar os estornos desta compra.</FormAlert>}

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {details.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="min-w-0 text-right font-medium break-words">{value}</dd>
          </div>
        ))}
      </dl>

      {card?.dia_fechamento && card.dia_vencimento && (
        <InstallmentPreview
          title="Parcelas e faturas"
          currency={currency}
          input={{
            accountId: card.id,
            config: { diaFechamento: card.dia_fechamento, diaVencimento: card.dia_vencimento },
            dataCompra: purchase.data_compra,
            totalCentavos: purchase.valor_total_centavos,
            numeroParcelas: purchase.parcelas,
            parcelaInicial: purchase.parcela_inicial,
          }}
        />
      )}

      {refunds.length > 0 && (
        <section aria-labelledby="compra-estornos" className="grid gap-1.5">
          <h3 id="compra-estornos" className="text-sm font-medium">
            Estornos ({refunds.length})
          </h3>
          <ul aria-label="Estornos da compra" className="divide-y rounded-lg border text-sm">
            {refunds.map((refund) => (
              <li key={refund.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                <span className="min-w-0">
                  <span className="block">{formatDay(refund.data)}</span>
                  {refund.descricao && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {refund.descricao}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="text-emerald-700 tabular-nums dark:text-emerald-400">
                    {formatMoney(refund.valor_centavos, currency, { signDisplay: 'always' })}
                  </span>
                  <ConfirmDeleteButton
                    what={`o estorno de ${money(refund.valor_centavos)} de ${formatDay(refund.data)}`}
                    consequence="O valor volta a contar como gasto e a fatura do estorno fica com esse crédito a menos."
                    disabled={removeRefund.isPending}
                    onConfirm={() => deleteRefund.run(() => removeRefund.mutateAsync(refund.id))}
                  />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ArchiveDeleteActions
        itemName={name}
        disabled={remove.isPending}
        deleteHint={`${registadas === 1 ? 'A parcela é apagada' : `As ${registadas} parcelas são apagadas`} com a compra${refunds.length > 0 ? ', tal como os estornos' : ''}.`}
        onDelete={() => run(() => remove.mutateAsync(purchase.id))}
      />

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
          Fechar
        </Button>
        {porEstornar > 0 && (
          <Button type="button" size="lg" onClick={onRefund}>
            Registar estorno
          </Button>
        )}
      </DialogFooter>
    </div>
  )
}

function RefundForm({
  purchase,
  card,
  category,
  porEstornar,
  onBack,
}: Props & { purchase: CardPurchase; porEstornar: number; onBack: () => void }) {
  const currency = useCurrency()
  const { serverError, run } = useServerAction(onBack)
  const create = useRegisterRefund()
  const name = purchase.descricao || category?.nome || 'Compra no cartão'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RefundFormInput, unknown, RefundFormValues>({
    resolver: zodResolver(
      refundFormSchema({ maxCentavos: porEstornar, dataCompra: purchase.data_compra }),
    ),
    defaultValues: { valor: centsToInput(porEstornar), data: todayIso(), descricao: '' },
  })

  const onSubmit = handleSubmit((values) =>
    run(() =>
      create.mutateAsync({
        compraId: purchase.id,
        valor: values.valor,
        data: values.data,
        descricao: values.descricao,
      }),
    ),
  )

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Estorno de {name}</DialogTitle>
        <DialogDescription>
          {card?.nome ?? 'Cartão'} · falta estornar {formatMoney(porEstornar, currency)}. Usa o
          valor e a data do extrato: o estorno entra na fatura dessa data e desconta dos gastos
          desse mês. As parcelas já registadas não mudam.
        </DialogDescription>
      </DialogHeader>

      {serverError && <FormAlert>{serverError}</FormAlert>}

      <TextField
        id="estorno-valor"
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
          id="estorno-data"
          label="Data"
          type="date"
          min={purchase.data_compra}
          max={todayIso()}
          error={errors.data?.message}
          {...register('data')}
        />
        <TextField
          id="estorno-descricao"
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
          {isSubmitting ? 'A registar…' : 'Registar estorno'}
        </Button>
      </DialogFooter>
    </form>
  )
}
