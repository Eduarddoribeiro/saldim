import { isIsoDate, type IsoDate } from '@/lib/dates'

// Leitura dos ficheiros dos bancos (docs/features/importar.md): CSV do Nubank (fatura do cartão e
// extrato da conta) e OFX (Itaú, Caixa e quase todos os bancos). Funções puras: nada de rede.

export type ImportLine = {
  /** Posição no ficheiro (chave estável para a lista de revisão) */
  id: string
  data: IsoDate
  descricao: string
  /** Sempre positivo; o sentido diz se saiu ou entrou */
  valorCentavos: number
  sentido: 'saida' | 'entrada'
  /** "Parcela k de n" na descrição */
  parcela: { numero: number; total: number } | null
}

export type ImportFormat = 'nubank-cartao' | 'nubank-conta' | 'ofx'

export class ImportError extends Error {
  override name = 'ImportError'
}

/** Lê um ficheiro de banco e devolve as linhas (sem as de valor zero). */
export function parseImportFile(text: string): { formato: ImportFormat; lines: ImportLine[] } {
  const clean = text.replace(/^\uFEFF/, '')
  if (/<OFX>|OFXHEADER/i.test(clean)) return { formato: 'ofx', lines: parseOfx(clean) }
  const rows = parseCsv(clean)
  const header = (rows[0] ?? []).map((cell) => normalize(cell))
  if (header.join(',') === 'date,title,amount') {
    return { formato: 'nubank-cartao', lines: parseRows(rows.slice(1), [0, 1, 2], 'positivo-sai') }
  }
  const data = header.indexOf('data')
  const valor = header.indexOf('valor')
  const descricao = header.findIndex((cell) => cell === 'descricao')
  if (data >= 0 && valor >= 0 && descricao >= 0) {
    return {
      formato: 'nubank-conta',
      lines: parseRows(rows.slice(1), [data, descricao, valor], 'negativo-sai'),
    }
  }
  throw new ImportError(
    'Formato não reconhecido. Use o CSV do Nubank (fatura ou extrato) ou um ficheiro OFX do banco.',
  )
}

function parseRows(
  rows: string[][],
  [dateIndex, descriptionIndex, amountIndex]: [number, number, number],
  sign: 'positivo-sai' | 'negativo-sai',
): ImportLine[] {
  const lines: ImportLine[] = []
  rows.forEach((row, index) => {
    if (row.every((cell) => cell.trim() === '')) return
    const data = parseDate(row[dateIndex] ?? '')
    const valor = parseAmount(row[amountIndex] ?? '')
    if (!data || valor === null) {
      throw new ImportError(`Linha ${index + 2}: data ou valor que não se consegue ler.`)
    }
    if (valor === 0) return
    const saida = sign === 'positivo-sai' ? valor > 0 : valor < 0
    lines.push(line(String(index), data, row[descriptionIndex] ?? '', Math.abs(valor), saida))
  })
  return lines
}

function parseOfx(text: string): ImportLine[] {
  const blocks = text.split(/<STMTTRN>/i).slice(1)
  if (blocks.length === 0) throw new ImportError('O ficheiro OFX não tem lançamentos.')
  const tag = (block: string, name: string) =>
    block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, 'i'))?.[1]?.trim() ?? ''
  const lines: ImportLine[] = []
  blocks.forEach((block, index) => {
    const data = parseDate(tag(block, 'DTPOSTED').slice(0, 8))
    const valor = parseAmount(tag(block, 'TRNAMT'))
    if (!data || valor === null) {
      throw new ImportError(
        `Lançamento ${index + 1} do OFX: data ou valor que não se consegue ler.`,
      )
    }
    if (valor === 0) return
    const descricao = tag(block, 'MEMO') || tag(block, 'NAME')
    lines.push(
      line(tag(block, 'FITID') || String(index), data, descricao, Math.abs(valor), valor < 0),
    )
  })
  return lines
}

function line(
  id: string,
  data: IsoDate,
  rawDescription: string,
  valorCentavos: number,
  saida: boolean,
): ImportLine {
  const { descricao, parcela } = detectInstallment(rawDescription.replace(/\s+/g, ' ').trim())
  return { id, data, descricao, valorCentavos, sentido: saida ? 'saida' : 'entrada', parcela }
}

const INSTALLMENT_PATTERNS = [
  // "Mercadolivre - Parcela 1/2", "Parcela 1 de 2"
  /\s*[-\u2013]?\s*parcela\s*0?(\d{1,2})\s*(?:\/|de)\s*0?(\d{1,2})\b/i,
  // "Mercadolivre*mparc01/02", "LOJA PARC 03/08", "PARC.03/08"
  /\s*\*?\s*m?parc\.?\s*0?(\d{1,2})\s*\/\s*0?(\d{1,2})\b/i,
  // "LOJA X 03/08" no fim
  /\s+0?(\d{1,2})\s*\/\s*0?(\d{1,2})\s*$/,
]

/** "Parcela k de n" na descrição (e a descrição sem esse pedaço). */
export function detectInstallment(description: string): {
  descricao: string
  parcela: { numero: number; total: number } | null
} {
  for (const pattern of INSTALLMENT_PATTERNS) {
    const match = description.match(pattern)
    if (!match) continue
    const numero = Number(match[1])
    const total = Number(match[2])
    if (total < 2 || total > 48 || numero < 1 || numero > total) continue
    const descricao = description
      .replace(match[0], '')
      .replace(/[\s*\u2013-]+$/, '')
      .trim()
    return { descricao: descricao || description, parcela: { numero, total } }
  }
  return { descricao: description, parcela: null }
}

/** Valor em centavos, com sinal: "56.30", "-1.234,56", "1234,5", "R$ 10" (null se não for número). */
export function parseAmount(text: string): number | null {
  let value = text.replace(/R\$|\s/g, '')
  const negative = /^-/.test(value) || /^\(.*\)$/.test(value)
  value = value.replace(/^[-+(]|\)$/g, '')
  if (value.includes(',') && value.includes('.')) {
    // O último separador é o decimal: "1.234,56" ou "1,234.56"
    value =
      value.lastIndexOf(',') > value.lastIndexOf('.')
        ? value.replace(/\./g, '').replace(',', '.')
        : value.replace(/,/g, '')
  } else {
    value = value.replace(',', '.')
  }
  const match = value.match(/^(\d+)(?:\.(\d{1,2}))?$/)
  if (!match) return null
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  return negative ? -cents : cents
}

/** "2026-11-17", "17/11/2026" ou "20261117" → IsoDate. */
export function parseDate(text: string): IsoDate | null {
  const value = text.trim()
  let iso: string | null = null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) iso = value
  else if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [d, m, y] = value.split('/')
    iso = `${y}-${m}-${d}`
  } else if (/^\d{8}$/.test(value))
    iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
  return iso && isIsoDate(iso) ? iso : null
}

/** CSV com aspas ("a, b" é uma célula) e separador vírgula ou ponto e vírgula. */
export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const separator =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === separator) {
      row.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += char
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

/** Minúsculas, sem acentos nem espaços nas pontas. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}
