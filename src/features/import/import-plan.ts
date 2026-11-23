import { halfSplit } from '@/lib/credit-card'
import type { IsoDate } from '@/lib/dates'
import { matchAccountLines, matchCardLines, type ExistingPurchase } from './match'
import type { ImportLine } from './parse'
import { aliasKey, suggestFor, type HistoryItem } from './suggest'

// Da lista de linhas do ficheiro à lista de revisão (docs/features/importar.md): o estado de cada
// linha e o que se regista. Função pura: a página só mostra e chama a API.

export type RowStatus = 'nova' | 'ja-registada' | 'pagamento'

/** '' = minha; 'p:<id>' = da pessoa; 'd:<id>' = dividida com a pessoa */
export type Owner = '' | `p:${string}` | `d:${string}`

export type ReviewRow = ImportLine & {
  status: RowStatus
  /** A descrição como veio do banco (a `descricao` é o nome que fica no Saldim) */
  descricaoBanco: string
  /** Escolhas da revisão (começam com as sugestões) */
  selecionada: boolean
  categoryId: string
  dono: Owner
}

export function buildReviewRows({
  lines,
  isCard,
  accountId,
  purchases,
  history,
  categories,
  aliases = [],
}: {
  /** Nomes escolhidos em importações anteriores (chave = aliasKey da descrição do banco) */
  aliases?: readonly { chave: string; descricao: string }[]
  lines: readonly ImportLine[]
  isCard: boolean
  accountId: string
  purchases: readonly (ExistingPurchase & { account_id: string })[]
  history: readonly (HistoryItem & { account_id: string; valor_centavos: number; data: IsoDate })[]
  categories: readonly { id: string; nome: string; tipo: string; arquivada: boolean }[]
}): ReviewRow[] {
  const already = isCard
    ? matchCardLines(
        lines,
        purchases.filter((purchase) => purchase.account_id === accountId),
      )
    : matchAccountLines(
        lines,
        history.filter((item) => item.account_id === accountId),
      )
  const names = new Map(aliases.map((alias) => [alias.chave, alias.descricao]))
  return lines.map((line) => {
    // No cartão, o que "entra" é pagamento ou crédito: regista-se em Cartões → Pagar
    const status: RowStatus =
      isCard && line.sentido === 'entrada'
        ? 'pagamento'
        : already.has(line.id)
          ? 'ja-registada'
          : 'nova'
    const tipo = line.sentido === 'saida' ? 'despesa' : 'receita'
    // O nome escolhido da última vez; a categoria e a pessoa vêm do histórico desse nome
    const nome = names.get(aliasKey(line.descricao)) ?? line.descricao
    const suggestion = suggestFor(nome, tipo, history, categories)
    return {
      ...line,
      descricao: nome,
      descricaoBanco: line.descricao,
      status,
      selecionada: status === 'nova',
      categoryId: suggestion.categoryId,
      dono: isCard && suggestion.pessoaId ? `p:${suggestion.pessoaId}` : '',
    }
  })
}

/** O que se envia para registar uma linha (conta: transação; cartão: compra, dividida ou não). */
export type ImportAction =
  | {
      kind: 'transaction'
      values: {
        tipo: 'despesa' | 'receita'
        valor: number
        data: IsoDate
        categoryId: string
        accountId: string
        descricao: string
      }
    }
  | { kind: 'purchase'; values: PurchaseValues }
  | { kind: 'split'; values: PurchaseValues & { valorPessoa: number } }

type PurchaseValues = {
  cardId: string
  valor: number
  parcelas: number
  parcelaInicial: number
  data: IsoDate
  categoryId: string
  descricao: string
  pessoaId: string
  novaPessoa: string
}

export function actionFor(row: ReviewRow, accountId: string, isCard: boolean): ImportAction {
  const descricao = row.descricao.slice(0, 120)
  if (!isCard) {
    return {
      kind: 'transaction',
      values: {
        tipo: row.sentido === 'saida' ? 'despesa' : 'receita',
        valor: row.valorCentavos,
        data: row.data,
        categoryId: row.categoryId,
        accountId,
        descricao,
      },
    }
  }
  // Parcela k de n: a compra inteira (valor da parcela × n), a partir dessa parcela (D5a)
  const parcelas = row.parcela?.total ?? 1
  const values: PurchaseValues = {
    cardId: accountId,
    valor: row.valorCentavos * parcelas,
    parcelas,
    parcelaInicial: row.parcela?.numero ?? 1,
    data: row.data,
    categoryId: row.categoryId,
    descricao,
    pessoaId: row.dono === '' ? '' : row.dono.slice(2),
    novaPessoa: '',
  }
  if (row.dono.startsWith('d:')) {
    return {
      kind: 'split',
      values: { ...values, valorPessoa: halfSplit(values.valor, parcelas).pessoa },
    }
  }
  return { kind: 'purchase', values }
}

/** Nomes a lembrar depois de importar: as linhas cujo nome foi mudado em relação ao do banco. */
export function aliasesToSave(rows: readonly ReviewRow[]): { chave: string; descricao: string }[] {
  const byKey = new Map<string, string>()
  for (const row of rows) {
    const nome = row.descricao.trim().slice(0, 120)
    const chave = aliasKey(row.descricaoBanco)
    if (chave && nome && nome !== row.descricaoBanco) byKey.set(chave, nome)
  }
  return [...byKey].map(([chave, descricao]) => ({ chave, descricao }))
}
