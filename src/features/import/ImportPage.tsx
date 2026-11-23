import { useQueryClient } from '@tanstack/react-query'
import { FileUp } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { FormAlert } from '@/components/form/FormAlert'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { isCreditCard, TIPO_CONTA_OPTIONS } from '@/features/accounts/account-options'
import { useAccounts } from '@/features/accounts/hooks'
import { usePurchases } from '@/features/card-purchases/hooks'
import { registerPurchase, registerSplitPurchase } from '@/features/card-purchases/purchases-api'
import { useCategories } from '@/features/categories/hooks'
import { usePeople } from '@/features/people/hooks'
import { useCurrency } from '@/features/profile/hooks'
import { ChoiceChips } from '@/features/quick-entry/ChoiceChips'
import { useImportHistory } from '@/features/transactions/hooks'
import { createTransaction } from '@/features/transactions/transactions-api'
import { errorMessage } from '@/lib/db-errors'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { actionFor, buildReviewRows, type Owner, type ReviewRow } from './import-plan'
import { ImportError, parseImportFile, type ImportFormat, type ImportLine } from './parse'

const FORMAT_LABELS: Record<ImportFormat, string> = {
  'nubank-cartao': 'Fatura de cartão (CSV do Nubank)',
  'nubank-conta': 'Extrato de conta (CSV do Nubank)',
  ofx: 'Ficheiro OFX do banco',
}

type Override = Partial<Pick<ReviewRow, 'selecionada' | 'categoryId' | 'dono'>>

/**
 * Importar (docs/features/importar.md): escolhe-se a conta ou o cartão e o ficheiro do banco; a lista
 * mostra só o que ainda não está no Saldim, com a categoria e a pessoa sugeridas; confirma-se tudo
 * de uma vez.
 */
export function ImportPage() {
  const accounts = useAccounts()
  const categories = useCategories()
  const purchases = usePurchases()
  const people = usePeople()
  const history = useImportHistory()
  const currency = useCurrency()
  const queryClient = useQueryClient()

  const [targetId, setTargetId] = useState<string | null>(null)
  const [file, setFile] = useState<{
    name: string
    formato: ImportFormat
    lines: ImportLine[]
  } | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<Record<string, Override>>({})
  const [showAll, setShowAll] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<{ ok: number; errors: [string, string][] } | null>(null)

  const active = (accounts.data ?? []).filter((account) => !account.arquivada)
  const target = active.find((account) => account.id === targetId)
  const isCard = target ? isCreditCard(target) : false
  const activePeople = (people.data ?? []).filter((person) => !person.arquivada)
  const loading = [accounts, categories, purchases, people, history].some((q) => q.isPending)

  const baseRows =
    file && target && !loading
      ? buildReviewRows({
          lines: file.lines,
          isCard,
          accountId: target.id,
          purchases: purchases.data ?? [],
          history: history.data ?? [],
          categories: categories.data ?? [],
        })
      : []
  const rows = baseRows.map((row) => ({ ...row, ...overrides[row.id] }))
  const toImport = rows.filter((row) => row.selecionada && row.status === 'nova' && row.categoryId)
  const shown = showAll ? rows : rows.filter((row) => row.status === 'nova')
  const hidden = rows.length - rows.filter((row) => row.status === 'nova').length
  const change = (id: string, patch: Override) =>
    setOverrides((current) => ({ ...current, [id]: { ...current[id], ...patch } }))

  const categoryOptions = (tipo: 'despesa' | 'receita') =>
    (categories.data ?? []).filter((category) => category.tipo === tipo && !category.arquivada)

  const readFile = async (picked: File | undefined) => {
    setFileError(null)
    setResult(null)
    setOverrides({})
    if (!picked) return
    try {
      const parsed = parseImportFile(await picked.text())
      setFile({ name: picked.name, ...parsed })
    } catch (cause) {
      setFile(null)
      setFileError(
        cause instanceof ImportError ? cause.message : 'Não foi possível ler este ficheiro.',
      )
    }
  }

  const runImport = async () => {
    if (!target) return
    const errors: [string, string][] = []
    let ok = 0
    setProgress({ done: 0, total: toImport.length })
    for (const [index, row] of toImport.entries()) {
      // Uma linha de cada vez: compras na mesma fatura nova não a podem criar ao mesmo tempo
      const action = actionFor(row, target.id, isCard)
      try {
        if (action.kind === 'transaction') await createTransaction(action.values)
        else if (action.kind === 'split') await registerSplitPurchase(action.values)
        else await registerPurchase(action.values)
        ok++
      } catch (cause) {
        errors.push([row.descricao, errorMessage(cause)])
      }
      setProgress({ done: index + 1, total: toImport.length })
    }
    await queryClient.invalidateQueries()
    setOverrides({})
    setProgress(null)
    setResult({ ok, errors })
  }

  return (
    <>
      <PageHeader
        title="Importar"
        description="Traga o extrato ou a fatura do banco e registre tudo de uma vez."
      />

      <div className="grid gap-5 pb-28 md:pb-24">
        <ChoiceChips
          legend="Para onde?"
          name="importar-destino"
          selected={targetId ?? ''}
          onChange={(event) => {
            setTargetId(event.target.value)
            setOverrides({})
            setResult(null)
          }}
          options={active.map((account) => ({
            value: account.id,
            label: account.nome,
            icon: TIPO_CONTA_OPTIONS[account.tipo].icon,
          }))}
        />

        <div className="grid gap-2">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Ficheiro do banco
          </span>
          <label
            htmlFor="importar-ficheiro"
            className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-dashed bg-card px-4 py-3 hover:bg-muted/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
          >
            <FileUp className="size-5 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {file ? file.name : 'Escolher ficheiro (CSV ou OFX)'}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {file
                  ? `${FORMAT_LABELS[file.formato]} · ${file.lines.length} linhas`
                  : 'Nubank: CSV da fatura ou do extrato · Itaú, Caixa: OFX'}
              </span>
            </span>
            <input
              id="importar-ficheiro"
              type="file"
              accept=".csv,.ofx,.txt,text/csv"
              className="sr-only"
              onChange={(event) => void readFile(event.target.files?.[0])}
            />
          </label>
          {fileError && <FormAlert>{fileError}</FormAlert>}
          {file?.formato === 'nubank-cartao' && target && !isCard && (
            <FormAlert>
              Este ficheiro parece ser a fatura de um cartão. Confira o destino.
            </FormAlert>
          )}
        </div>

        {result && (
          <div role="status" className="grid gap-2 rounded-2xl border bg-card p-4 text-sm">
            <p className="font-medium">
              {result.ok === 1 ? '1 lançamento importado.' : `${result.ok} lançamentos importados.`}
            </p>
            {result.errors.map(([descricao, message], index) => (
              <p key={index} className="text-destructive">
                {descricao}: {message}
              </p>
            ))}
            <Link
              to="/transacoes"
              className="font-medium text-primary underline underline-offset-4"
            >
              Ver no Extrato
            </Link>
          </div>
        )}

        {file && target && (
          <section aria-labelledby="importar-revisao" className="grid gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <h2
                id="importar-revisao"
                className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
              >
                {loading ? 'Comparando com o Saldim…' : `Novos: ${rows.length - hidden}`}
              </h2>
              {hidden > 0 && (
                <button
                  type="button"
                  className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => setShowAll((value) => !value)}
                >
                  {showAll ? 'Esconder' : 'Mostrar'} {hidden} que não entram
                </button>
              )}
            </div>
            {!loading && shown.length === 0 && (
              <p className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
                Tudo o que está neste ficheiro já está no Saldim.
              </p>
            )}
            {shown.length > 0 && (
              <ul
                aria-label="Lançamentos do ficheiro"
                className="divide-y rounded-2xl border bg-card"
              >
                {shown.map((row) => (
                  <ReviewItem
                    key={row.id}
                    row={row}
                    isCard={isCard}
                    money={(cents) => formatMoney(cents, currency)}
                    categories={categoryOptions(row.sentido === 'saida' ? 'despesa' : 'receita')}
                    people={activePeople}
                    onChange={(patch) => change(row.id, patch)}
                  />
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {file && target && (
        // Colado ao fundo (no telemóvel, por cima da barra de navegação)
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 border-t bg-background/95 p-4 backdrop-blur md:sticky md:bottom-0 md:-mx-8 md:px-8">
          <Button
            size="lg"
            className="h-12 w-full rounded-full text-base"
            disabled={toImport.length === 0 || progress !== null || loading}
            onClick={() => void runImport()}
          >
            {progress
              ? `Importando ${progress.done} de ${progress.total}…`
              : toImport.length === 1
                ? 'Importar 1 lançamento'
                : `Importar ${toImport.length} lançamentos`}
          </Button>
        </div>
      )}
    </>
  )
}

function ReviewItem({
  row,
  isCard,
  money,
  categories,
  people,
  onChange,
}: {
  row: ReviewRow
  isCard: boolean
  money: (cents: number) => string
  categories: { id: string; nome: string }[]
  people: { id: string; nome: string }[]
  onChange: (patch: Override) => void
}) {
  const importable = row.status === 'nova'
  const date = `${row.data.slice(8, 10)}/${row.data.slice(5, 7)}`
  const signed = row.sentido === 'saida' ? -row.valorCentavos : row.valorCentavos
  const detail = [
    date,
    row.parcela ? `Parcela ${row.parcela.numero}/${row.parcela.total}` : null,
    row.status === 'ja-registada' ? 'Já está no Saldim' : null,
    row.status === 'pagamento' ? 'Pagamento ou crédito: registre em Cartões' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className={cn('grid gap-2 px-4 py-3', !importable && 'opacity-60')}>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-5 shrink-0 accent-primary"
          checked={row.selecionada}
          disabled={!importable}
          onChange={(event) => onChange({ selecionada: event.target.checked })}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{row.descricao || 'Sem descrição'}</span>
          <span className="block truncate text-xs text-muted-foreground">{detail}</span>
        </span>
        <span
          className={cn(
            'shrink-0 font-medium tabular-nums',
            signed > 0 ? 'text-positive' : 'text-foreground',
          )}
        >
          {money(signed)}
        </span>
      </label>
      {importable && row.selecionada && (
        <div className={cn('grid gap-2 pl-8', isCard && 'sm:grid-cols-2')}>
          <select
            aria-label={`Categoria de ${row.descricao}`}
            value={row.categoryId}
            onChange={(event) => onChange({ categoryId: event.target.value })}
            className="h-10 min-w-0 rounded-lg border bg-background px-2 text-sm"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.nome}
              </option>
            ))}
          </select>
          {isCard && (
            <select
              aria-label={`De quem é ${row.descricao}`}
              value={row.dono}
              onChange={(event) => onChange({ dono: event.target.value as Owner })}
              className="h-10 min-w-0 rounded-lg border bg-background px-2 text-sm"
            >
              <option value="">Minha</option>
              {people.map((person) => (
                <option key={`p-${person.id}`} value={`p:${person.id}`}>
                  De {person.nome}
                </option>
              ))}
              {people.map((person) => (
                <option key={`d-${person.id}`} value={`d:${person.id}`}>
                  Dividida com {person.nome}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </li>
  )
}
