// Cor do cartão desenhado pelo banco (pedido de 2026-11-23: "pra não ficar tudo igual"). O banco é
// reconhecido pelo nome que se deu ao cartão (ex.: "Cartão Itaú", "Nubank", "picpay"); sem banco
// conhecido, fica a cor da app. As classes estão escritas por inteiro para o Tailwind as encontrar.

export type BankKey =
  | 'nubank'
  | 'itau'
  | 'picpay'
  | 'inter'
  | 'c6'
  | 'santander'
  | 'bradesco'
  | 'caixa'
  | 'bb'
  | 'mercadopago'

/** Ordem importa: o primeiro padrão que aparecer no nome ganha. */
const PATTERNS: [BankKey, RegExp][] = [
  ['nubank', /\bnu ?bank\b|\broxinho\b/],
  ['itau', /\bitau\b|\biti\b/],
  ['picpay', /\bpic ?pay\b/],
  ['mercadopago', /\bmercado ?pago\b/],
  ['inter', /\binter\b/],
  ['c6', /\bc6\b/],
  ['santander', /\bsantander\b/],
  ['bradesco', /\bbradesco\b/],
  ['caixa', /\bcaixa\b/],
  ['bb', /\bbanco do brasil\b|\bbb\b|\bourocard\b/],
]

/** Banco de um cartão pelo nome (sem acentos nem maiúsculas), ou null. */
export function bankOf(cardName: string): BankKey | null {
  const name = cardName
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
  return PATTERNS.find(([, pattern]) => pattern.test(name))?.[0] ?? null
}

/** Degradê e cor do texto do cartão desenhado. */
export const BANK_CARD_CLASSES: Record<BankKey | 'default', string> = {
  nubank: 'from-bank-nubank to-bank-nubank-2 text-bank-on-dark',
  itau: 'from-bank-itau to-bank-itau-2 text-bank-on-dark',
  picpay: 'from-bank-picpay to-bank-picpay-2 text-bank-on-dark',
  inter: 'from-bank-inter to-bank-inter-2 text-bank-on-dark',
  c6: 'from-bank-c6 to-bank-c6-2 text-bank-on-dark',
  santander: 'from-bank-santander to-bank-santander-2 text-bank-on-dark',
  bradesco: 'from-bank-bradesco to-bank-bradesco-2 text-bank-on-dark',
  caixa: 'from-bank-caixa to-bank-caixa-2 text-bank-on-dark',
  bb: 'from-bank-bb to-bank-bb-2 text-bank-on-light',
  mercadopago: 'from-bank-mercadopago to-bank-mercadopago-2 text-bank-on-dark',
  default: 'from-hero to-hero-2 text-hero-foreground',
}

/** Bolinha com a cor do banco (nas listas por cartão). */
export const BANK_DOT_CLASSES: Record<BankKey | 'default', string> = {
  nubank: 'bg-bank-nubank',
  itau: 'bg-bank-itau',
  picpay: 'bg-bank-picpay',
  inter: 'bg-bank-inter',
  c6: 'bg-bank-c6',
  santander: 'bg-bank-santander',
  bradesco: 'bg-bank-bradesco',
  caixa: 'bg-bank-caixa',
  bb: 'bg-bank-bb',
  mercadopago: 'bg-bank-mercadopago',
  default: 'bg-primary',
}

export const cardClasses = (cardName: string) => BANK_CARD_CLASSES[bankOf(cardName) ?? 'default']
export const dotClasses = (cardName: string) => BANK_DOT_CLASSES[bankOf(cardName) ?? 'default']
