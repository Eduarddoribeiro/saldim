import { ArchiveDeleteActions } from '@/components/form/ArchiveDeleteActions'
import { FormAlert } from '@/components/form/FormAlert'
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
import { formatDay } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { useDeletePurchase } from './hooks'
import { InstallmentPreview } from './InstallmentPreview'
import type { CardPurchase } from './purchases-api'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  purchase: CardPurchase | null
  card: Account | undefined
  category: Category | undefined
}

/**
 * Detalhe de uma compra no cartão (abre-se a partir de qualquer parcela). Na v1 uma compra não se
 * edita: apaga-se (as parcelas vão com ela) e regista-se de novo.
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

function PurchaseDetails({
  onOpenChange,
  purchase,
  card,
  category,
}: Props & { purchase: CardPurchase }) {
  const currency = useCurrency()
  const { serverError, run } = useServerAction(() => onOpenChange(false))
  const remove = useDeletePurchase()
  const name = purchase.descricao || category?.nome || 'Compra no cartão'
  const registadas = purchase.parcelas - purchase.parcela_inicial + 1

  const details: [string, string][] = [
    ['Cartão', card?.nome ?? '—'],
    ['Categoria', category?.nome ?? 'Sem categoria'],
    ['Data da compra', formatDay(purchase.data_compra)],
    ['Valor total', formatMoney(purchase.valor_total_centavos, currency)],
    [
      'Parcelas',
      purchase.parcela_inicial > 1
        ? `${purchase.parcelas}× (registadas da ${purchase.parcela_inicial}.ª à ${purchase.parcelas}.ª)`
        : `${purchase.parcelas}×`,
    ],
  ]

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{name}</DialogTitle>
        <DialogDescription>
          Compra no cartão. Para corrigir, apaga-a e regista-a de novo.
        </DialogDescription>
      </DialogHeader>

      {serverError && <FormAlert>{serverError}</FormAlert>}

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
            config: { diaFechamento: card.dia_fechamento, diaVencimento: card.dia_vencimento },
            dataCompra: purchase.data_compra,
            totalCentavos: purchase.valor_total_centavos,
            numeroParcelas: purchase.parcelas,
            parcelaInicial: purchase.parcela_inicial,
          }}
        />
      )}

      <ArchiveDeleteActions
        itemName={name}
        disabled={remove.isPending}
        deleteHint={`${registadas === 1 ? 'A parcela é apagada' : `As ${registadas} parcelas são apagadas`} com a compra.`}
        onDelete={() => run(() => remove.mutateAsync(purchase.id))}
      />

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
          Fechar
        </Button>
      </DialogFooter>
    </div>
  )
}
