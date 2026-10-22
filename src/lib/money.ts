// Dinheiro no Saldim: SEMPRE centavos inteiros (number inteiro no TS, bigint no Postgres).
// Conversão só nas extremidades: texto → centavos ao ler um formulário, centavos → texto ao mostrar.
// Regras completas em docs/plano.md → "Valores monetários".

export type Currency = 'BRL' | 'EUR'

export const CURRENCY_LOCALE: Record<Currency, string> = {
  BRL: 'pt-BR',
  EUR: 'pt-PT',
}

/** Limite por valor: 999 999 999,99 — muito acima de qualquer uso pessoal e longe do limite de inteiros seguros. */
export const MAX_CENTS = 99_999_999_999

// Padrões aceites (depois de remover símbolo de moeda e espaços):
const COMMA_DECIMAL = /^(\d{1,3}(?:\.\d{3})+|\d+),(\d{1,2})$/ // 1.234,56 · 1234,5
const DOT_THOUSANDS = /^\d{1,3}(?:\.\d{3})+$/ // 1.234 · 1.234.567  (ponto seguido de 3 dígitos = milhares)
const DOT_DECIMAL = /^(\d+)\.(\d{1,2})$/ // 12.5 · 12.50        (ponto seguido de 1–2 dígitos = decimal)
const INTEGER = /^\d+$/ // 1234

/**
 * Converte o que a pessoa escreveu em centavos, sem usar vírgula flutuante.
 * Devolve `null` se o texto não for um valor válido.
 *
 * parseMoney('1.234,56') → 123456 · parseMoney('R$ 12,5') → 1250 · parseMoney('12.50') → 1250
 * parseMoney('1.234') → 123400 · parseMoney('-10', { allowNegative: true }) → -1000
 */
export function parseMoney(
  input: string,
  options: { allowNegative?: boolean } = {},
): number | null {
  // O padrão \s também apanha os espaços não separáveis (U+00A0, U+202F) que o Intl e alguns teclados usam
  let text = input.replace(/R\$|€/g, '').replace(/\s/g, '')

  let negative = false
  if (text.startsWith('-') || text.startsWith('−')) {
    if (!options.allowNegative) return null
    negative = true
    text = text.slice(1)
  }

  let integerPart: string
  let fractionPart = ''
  let match: RegExpMatchArray | null

  if ((match = text.match(COMMA_DECIMAL))) {
    integerPart = match[1]
    fractionPart = match[2]
  } else if (DOT_THOUSANDS.test(text) || INTEGER.test(text)) {
    integerPart = text
  } else if ((match = text.match(DOT_DECIMAL))) {
    integerPart = match[1]
    fractionPart = match[2]
  } else {
    return null
  }

  const units = Number(integerPart.replaceAll('.', ''))
  const cents = units * 100 + Number(fractionPart.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) return null
  return negative && cents !== 0 ? -cents : cents
}

const formatters = new Map<string, Intl.NumberFormat>()

function formatter(currency: Currency, signDisplay: Intl.NumberFormatOptions['signDisplay']) {
  const key = `${currency}:${signDisplay}`
  let cached = formatters.get(key)
  if (!cached) {
    cached = new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
      style: 'currency',
      currency,
      signDisplay,
    })
    formatters.set(key, cached)
  }
  return cached
}

/**
 * Centavos → texto para mostrar. formatMoney(123456) → "R$ 1.234,56" (com espaço não separável).
 * `signDisplay: 'always'` mostra "+R$ 10,00" (útil para receitas).
 */
export function formatMoney(
  cents: number,
  currency: Currency = 'BRL',
  options: { signDisplay?: 'auto' | 'always' | 'exceptZero' } = {},
): string {
  assertCents(cents)
  // A divisão por 100 só acontece na apresentação: aqui e em formatMoneyCompact.
  return formatter(currency, options.signDisplay ?? 'auto').format(cents / 100)
}

const compactFormatters = new Map<Currency, Intl.NumberFormat>()

/**
 * Centavos → texto curto, só para eixos de gráficos: 123456789 → "R$ 1,2 mi".
 * Arredonda: os valores exatos ficam nas dicas e nas tabelas, que usam formatMoney.
 */
export function formatMoneyCompact(cents: number, currency: Currency = 'BRL'): string {
  assertCents(cents)
  let cached = compactFormatters.get(currency)
  if (!cached) {
    cached = new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
      style: 'currency',
      currency,
      notation: 'compact',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    })
    compactFormatters.set(currency, cached)
  }
  return cached.format(cents / 100)
}

/** Centavos → texto para preencher um campo editável: 123456 → "1234,56" (sem milhares nem símbolo). */
export function centsToInput(cents: number): string {
  assertCents(cents)
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}${Math.trunc(abs / 100)},${String(abs % 100).padStart(2, '0')}`
}

/** Garante que um valor é um número inteiro de centavos (apanha cedo erros como passar 12.5). */
export function assertCents(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`Valor monetário inválido: ${value} (esperados centavos inteiros)`)
  }
}
