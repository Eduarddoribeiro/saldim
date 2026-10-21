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
      {/* Telemóvel: um bloco por cartão (a tabela de 4 colunas não cabe a 360px e cortava valores) */}
      <section aria-labelledby={`por-cartao-${personId}`} className="grid gap-2 sm:hidden">
        <h4 id={`por-cartao-${personId}`} className="text-sm font-medium">
          Compras de {personName} por cartão
        </h4>
        <ul className="divide-y rounded-lg border text-sm">
          {[
            ...cards.map((card) => ({ key: card.cardId, nome: cardName(card.cardId), ...card })),
            ...(cards.length > 1 ? [{ key: 'total', nome: 'Todos os cartões', ...total }] : []),
          ].map((row) => (
            <li key={row.key} className="grid gap-1 px-3 py-2">
              <span className={row.key === 'total' ? 'font-medium' : undefined}>{row.nome}</span>
              <dl className="grid grid-cols-[1fr_auto] gap-x-3 text-xs tabular-nums">
                <dt className="text-muted-foreground">Faturas vencidas</dt>
                <dd className="text-right">{money(row.vencido)}</dd>
                <dt className="text-muted-foreground">Faturas futuras</dt>
                <dd className="text-right">{money(row.futuro)}</dd>
                <dt className="text-muted-foreground">Total</dt>
                <dd className="text-right font-medium">{money(row.vencido + row.futuro)}</dd>
              </dl>
            </li>
          ))}
        </ul>
      </section>

      <div className="overflow-x-auto max-sm:hidden">
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
                Todos os cartões
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
            ? debts.length === 1
              ? '1 compra'
              : `${debts.length} compras`
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
    // Nome e valor numa linha; o resto por baixo, a toda a largura (lado a lado espremia o cartão)
    <li className="grid gap-0.5 px-3 py-2">
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate">{name}</span>
        <span className="shrink-0 tabular-nums">{money(purchase.valor_total_centavos)}</span>
      </span>
      <span className="text-xs text-muted-foreground">
        {cardName} · {shortDate(purchase.data_compra)} · {tipo}
      </span>
      {(debt.vencido !== 0 || debt.futuro !== 0) && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {[
            debt.vencido !== 0 ? `Faturas vencidas ${money(debt.vencido)}` : null,
            debt.futuro !== 0 ? `Faturas futuras ${money(debt.futuro)}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      )}
    </li>
  )
}
