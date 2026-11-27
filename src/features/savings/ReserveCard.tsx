import { Check, PiggyBank, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDeleteButton } from '@/components/form/ConfirmDeleteButton'
import { FormAlert } from '@/components/form/FormAlert'
import { TextField } from '@/components/form/TextField'
import { Button } from '@/components/ui/button'
import { isSavings } from '@/features/accounts/account-options'
import type { Account } from '@/features/accounts/accounts-api'
import { useCreateAccount } from '@/features/accounts/hooks'
import { reserveMilestones, RESERVE_STARS } from '@/features/journey/journey'
import { useQuickEntry } from '@/features/quick-entry/quick-entry-context'
import { useAccountTransfers, useDeleteTransfer } from '@/features/transfers/hooks'
import { errorMessage } from '@/lib/db-errors'
import { cn } from '@/lib/utils'
import { AdjustYieldDialog } from './AdjustYieldDialog'
import { CDI } from './rates'
import { monthsToReach, RESERVE_MONTHS } from './simulate'

const shortDate = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`

/**
 * A reserva de emergência como um pote que enche (pedido de 2026-11-26): quanto já tem nas contas
 * Poupança/Investimentos, os marcos até à meta (3 meses de gastos), quanto rende por mês, "Guardar
 * agora" (transferência para a caixinha) e "Acertar com o banco" (o rendimento real).
 */
export function ReserveCard({
  spending,
  saved,
  deposit,
  accounts,
  money,
}: {
  spending: number
  saved: number
  deposit: number
  accounts: Account[]
  money: (cents: number) => string
}) {
  const openEntry = useQuickEntry()
  const transfers = useAccountTransfers()
  const remove = useDeleteTransfer()
  const createAccount = useCreateAccount()
  const [nome, setNome] = useState('Cofrinho')
  const [error, setError] = useState<string | null>(null)
  const [adjusting, setAdjusting] = useState(false)
  const savingsAccounts = accounts.filter((account) => isSavings(account) && !account.arquivada)
  const caixinha = savingsAccounts[0]
  const marcos = reserveMilestones(spending)
  const meta = marcos.at(-1)?.valor ?? 0
  const savingsIds = new Set(savingsAccounts.map((account) => account.id))
  const depositos = (transfers.data ?? [])
    .filter((transfer) => savingsIds.has(transfer.conta_destino_id))
    .slice(0, 5)
  const monthlyYield = Math.round(Math.max(0, saved) * (Math.pow(1 + CDI, 1 / 12) - 1))
  const months = meta > 0 ? monthsToReach(meta, Math.max(0, saved), deposit) : null
  const fill = meta > 0 ? Math.min(1, Math.max(0, saved) / meta) : 0

  return (
    <section
      aria-labelledby="reserva"
      className="grid min-w-0 gap-4 rounded-2xl border bg-card p-4 *:min-w-0"
    >
      <div className="grid gap-0.5">
        <h2 id="reserva" className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="size-5 text-primary" aria-hidden />
          Primeiro: reserva de emergência
        </h2>
        {meta > 0 && (
          <p className="text-sm text-muted-foreground tabular-nums">Meta: {money(meta)}</p>
        )}
      </div>

      <div className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-4">
        <div
          role="progressbar"
          aria-label="Reserva de emergência"
          aria-valuemin={0}
          aria-valuemax={meta}
          aria-valuenow={Math.min(Math.max(0, saved), meta)}
          aria-valuetext={`${money(saved)} de ${money(meta)}`}
          className="relative h-22 w-16 overflow-hidden rounded-t-xl rounded-b-2xl border-2 border-border"
        >
          <div
            className="absolute inset-x-0 bottom-0 bg-linear-to-b from-green-400 to-green-600 motion-safe:transition-all"
            style={{ height: `${fill * 100}%` }}
          />
        </div>
        <div className="grid gap-0.5">
          <span className="text-xs text-muted-foreground">Já tem</span>
          <span className="text-2xl font-bold tracking-tight tabular-nums">{money(saved)}</span>
          {monthlyYield > 0 && (
            <span className="text-xs text-muted-foreground">
              Rende uns {money(monthlyYield)} por mês (100% do CDI, estimado)
            </span>
          )}
        </div>
      </div>

      {marcos.length > 0 && (
        <ul aria-label="Marcos da reserva" className="grid gap-1.5 text-sm">
          {marcos.map((marco) => {
            const done = saved >= marco.valor
            return (
              <li key={marco.nome} className="flex items-center justify-between gap-3">
                <span className={cn('flex min-w-0 items-center gap-2', done && 'text-positive')}>
                  {done ? (
                    <Check className="size-4 shrink-0" aria-hidden />
                  ) : (
                    <span aria-hidden className="size-4 shrink-0 rounded-full border-2" />
                  )}
                  <span className="truncate">
                    {money(marco.valor)} · {marco.nome}
                  </span>
                </span>
                <span
                  className={cn(
                    'shrink-0 text-xs',
                    done ? 'text-positive' : 'text-muted-foreground',
                  )}
                >
                  {done ? 'feito · ' : ''}+{marco.estrelas}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {spending > 0 && (
        <p className="text-xs text-muted-foreground">
          A meta é {RESERVE_MONTHS} meses dos seus gastos: {money(spending)} por mês, pelo que você
          gastou nos últimos 30 dias (ou a média dos meses anteriores, se for maior).{' '}
          {saved >= meta
            ? 'Reserva completa: o que guardar agora pode ir para prazos maiores.'
            : months !== null && deposit > 0
              ? `Guardando ${money(deposit)} por mês, chega lá em uns ${months} ${months === 1 ? 'mês' : 'meses'}.`
              : ''}{' '}
          Só tire de lá em emergência: saúde, algo quebrado, uma renda que parou.
        </p>
      )}
      {spending > 0 && saved < meta && (
        <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
          <b className="font-medium text-foreground">A reserva já é um investimento:</b> rende 100%
          do CDI e você saca quando precisar.{' '}
          {saved >= spending
            ? `Você já tem 1 mês de gastos guardado: dá para começar a dividir, uns 70% aqui e 30% num investimento de prazo maior (CDB de 2 anos, LCI/LCA, Tesouro IPCA+).`
            : `Quando tiver 1 mês de gastos (${money(spending)}), dá para dividir: uns 70% aqui e 30% num investimento de prazo maior.`}
        </p>
      )}

      {error && <FormAlert>{error}</FormAlert>}
      {caixinha ? (
        <div className="grid gap-2">
          <Button
            size="lg"
            className="h-12 rounded-full text-base"
            onClick={() =>
              openEntry({
                transfer: {
                  toAccountId: caixinha.id,
                  valor: deposit || undefined,
                  descricao: 'Reserva',
                },
              })
            }
          >
            <PiggyBank aria-hidden />
            {deposit > 0 ? `Guardar ${money(deposit)} agora` : 'Guardar agora'} · +{RESERVE_STARS}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-11 rounded-full"
            onClick={() => setAdjusting(true)}
          >
            Acertar com o valor do banco
          </Button>
        </div>
      ) : (
        <form
          className="grid gap-2 rounded-xl bg-muted/60 p-3"
          onSubmit={(event) => {
            event.preventDefault()
            setError(null)
            createAccount.mutate(
              { nome: nome.trim() || 'Cofrinho', tipo: 'poupanca', saldoInicial: 0, cartao: null },
              { onError: (cause) => setError(errorMessage(cause)) },
            )
          }}
        >
          <p className="text-sm">
            Para o app saber quanto você guardou, crie a conta da sua caixinha (tipo Poupança).
            Depois é só usar "Guardar agora".
          </p>
          <TextField
            id="reserva-nome"
            label="Nome da caixinha"
            maxLength={40}
            value={nome}
            onChange={(event) => setNome(event.target.value)}
          />
          <Button type="submit" className="rounded-full" disabled={createAccount.isPending}>
            Criar a caixinha
          </Button>
        </form>
      )}

      {depositos.length > 0 && (
        <div className="grid gap-1">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Últimos depósitos
          </h3>
          <ul aria-label="Últimos depósitos" className="divide-y text-sm">
            {depositos.map((transfer) => (
              <li key={transfer.id} className="flex items-center justify-between gap-3 py-1.5">
                <span className="min-w-0 truncate">
                  {shortDate(transfer.data)} · {transfer.descricao || 'Depósito'}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="font-medium tabular-nums">{money(transfer.valor_centavos)}</span>
                  <ConfirmDeleteButton
                    what={`o depósito de ${money(transfer.valor_centavos)} de ${shortDate(transfer.data)}`}
                    consequence="O dinheiro volta para a conta de onde saiu, no app."
                    disabled={remove.isPending}
                    onConfirm={() =>
                      remove.mutate(transfer.id, {
                        onError: (cause) => setError(errorMessage(cause)),
                      })
                    }
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {caixinha && (
        <AdjustYieldDialog
          open={adjusting}
          onOpenChange={setAdjusting}
          account={caixinha}
          saved={saved}
          money={money}
        />
      )}
    </section>
  )
}
