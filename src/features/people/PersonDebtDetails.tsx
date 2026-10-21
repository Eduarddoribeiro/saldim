import { useState } from 'react'
import { SelectField } from '@/components/form/SelectField'
import type { Account } from '@/features/accounts/accounts-api'
import type { CardPurchase } from '@/features/card-purchases/purchases-api'
import type { Category } from '@/features/categories/categories-api'
import { formatMoney, type Currency } from '@/lib/money'
import {
  debtsByCard,
  filterDebts,
  NO_FILTERS,
  purchaseDebts,
  type DebtFilters,
  type DetailMovement,
  type PurchaseDebt,
} from './receivable-details'

const shortDate = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`

const TIPO_OPTIONS = [
  { value: 'todas', label: 'Todas' },
  { value: 'avista', label: 'À vista' },
  { value: 'parceladas', label: 'Parceladas' },
]

const SITUACAO_OPTIONS = [
  { value: 'todas', label: 'Todas' },
  { value: 'abertas', label: 'Com parcelas a vencer' },
  { value: 'terminadas', label: 'Todas já vencidas' },
]

/**
 * Compras de uma pessoa por cartão (T1): resumo por cartão e lista filtrável por cartão, à vista ou
 * parcelada, e situação. Valores brutos das compras: os pagamentos e a dívida anterior ficam à parte.
 */
export function PersonDebtDetails({
  personId,
  personName,
  purchases,
  movements,
  dueInvoiceIds,
  accounts,
  categories,
  currency,
}: {
  personId: string
  personName: string
  purchases: CardPurchase[]
  movements: DetailMovement[]
  dueInvoiceIds: ReadonlySet<string>
  accounts: Account[]
  categories: Category[]
  currency: Currency
}) {
  const [filters, setFilters] = useState<DebtFilters>(NO_FILTERS)
  const money = (cents: number) => formatMoney(cents, currency)
  const cardName = (id: string) => accounts.find((account) => account.id === id)?.nome ?? 'Cartão'

  const debts = purchaseDebts(purchases, movements, dueInvoiceIds)
  const { cards, total } = debtsByCard(debts)
  const shown = filterDebts(debts, filters)
  const set = (patch: Partial<DebtFilters>) => setFilters((current) => ({ ...current, ...patch }))

  if (purchases.length === 0) {
    return <p className="mt-2 text-sm text-muted-foreground">Nenhuma compra no cartão ainda.</p>
  }

  return (
    <div className="mt-3 grid gap-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="mb-1 text-left text-sm font-medium">
            Compras de {personName} por cartão
          </caption>
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="py-1 pr-2 font-normal">
                Cartão
              </th>
              <th scope="col" className="py-1 pr-2 text-right font-normal">
                Faturas vencidas
              </th>
              <th scope="col" className="py-1 pr-2 text-right font-normal">
                Faturas futuras
              </th>
              <th scope="col" className="py-1 text-right font-normal">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {cards.map((card) => (
              <tr key={card.cardId} className="border-t">
                <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                  {cardName(card.cardId)}
                </th>
                <td className="py-1.5 pr-2 text-right">{money(card.vencido)}</td>
                <td className="py-1.5 pr-2 text-right">{money(card.futuro)}</td>
                <td className="py-1.5 text-right">{money(card.vencido + card.futuro)}</td>
              </tr>
            ))}
            <tr className="border-t font-medium">
              <th scope="row" className="py-1.5 pr-2 text-left">
                Todos
              </th>
              <td className="py-1.5 pr-2 text-right">{money(total.vencido)}</td>
              <td className="py-1.5 pr-2 text-right">{money(total.futuro)}</td>
              <td className="py-1.5 text-right">{money(total.vencido + total.futuro)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="sr-only">Filtrar as compras de {personName}</legend>
        <SelectField
          id={`filtro-cartao-${personId}`}
          label="Cartão"
          options={[
            { value: '', label: 'Todos' },
            ...cards.map((card) => ({ value: card.cardId, label: cardName(card.cardId) })),
          ]}
          value={filters.cardId}
          onChange={(event) => set({ cardId: event.target.value })}
        />
        <SelectField
          id={`filtro-tipo-${personId}`}
          label="Tipo"
          options={TIPO_OPTIONS}
          value={filters.tipo}
          onChange={(event) => set({ tipo: event.target.value as DebtFilters['tipo'] })}
        />
        <SelectField
          id={`filtro-situacao-${personId}`}
          label="Situação"
          options={SITUACAO_OPTIONS}
          value={filters.situacao}
          onChange={(event) => set({ situacao: event.target.value as DebtFilters['situacao'] })}
        />
      </fieldset>

      <div>
        <p className="mb-1 text-xs text-muted-foreground" role="status">
          {shown.length === debts.length
            ? `${debts.length} compras`
            : `${shown.length} de ${debts.length} compras`}
          {' · faturas vencidas '}
          {money(shown.reduce((sum, debt) => sum + debt.vencido, 0))}
          {' · faturas futuras '}
          {money(shown.reduce((sum, debt) => sum + debt.futuro, 0))}
        </p>
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma compra com estes filtros.</p>
        ) : (
          <ul
            aria-label={`Compras de ${personName}`}
            className="divide-y rounded-lg border text-sm"
          >
            {shown.map((debt) => (
              <PurchaseDebtRow
                key={debt.purchase.id}
                debt={debt}
                name={
                  debt.purchase.descricao ||
                  categories.find((category) => category.id === debt.purchase.category_id)?.nome ||
                  'Compra no cartão'
                }
                cardName={cardName(debt.purchase.account_id)}
                money={money}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function PurchaseDebtRow({
  debt,
  name,
  cardName,
  money,
}: {
  debt: PurchaseDebt
  name: string
  cardName: string
  money: (cents: number) => string
}) {
  const { purchase } = debt
  const tipo = debt.parcelada
    ? debt.parcelasFuturas > 0
      ? `${purchase.parcelas}× · faltam ${debt.parcelasFuturas} de ${purchase.parcelas}`
      : `${purchase.parcelas}× · todas vencidas`
    : 'À vista'
  return (
    <li className="flex items-start justify-between gap-3 px-3 py-2">
      <span className="min-w-0">
        <span className="block truncate">{name}</span>
        <span className="block text-xs text-muted-foreground">
          {cardName} · {shortDate(purchase.data_compra)} · {tipo}
        </span>
      </span>
      <span className="shrink-0 text-right text-xs tabular-nums">
        <span className="block text-sm">{money(purchase.valor_total_centavos)}</span>
        {debt.vencido !== 0 && (
          <span className="block text-muted-foreground">
            Faturas vencidas {money(debt.vencido)}
          </span>
        )}
        {debt.futuro !== 0 && (
          <span className="block text-muted-foreground">Faturas futuras {money(debt.futuro)}</span>
        )}
      </span>
    </li>
  )
}
