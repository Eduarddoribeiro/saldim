import { z } from 'zod'
import { purchaseFormSchema, type PurchaseFormValues } from '@/features/card-purchases/schemas'
import { TIPOS } from '@/features/categories/schemas'
import { parseMoney } from '@/lib/money'
import { transactionFormSchema, type TransactionFormValues } from '@/features/transactions/schemas'

/** De quem é uma compra no cartão: minha, de outra pessoa ou dividida com ela. */
export const DIVISOES = ['minha', 'pessoa', 'dividida'] as const
export type Divisao = (typeof DIVISOES)[number]

/**
 * Formulário único de lançamento (receita, despesa ou compra no cartão). Não repete regras: se a
 * conta escolhida for um cartão, valida com `purchaseFormSchema` (C4/T1); senão, com
 * `transactionFormSchema`. Os erros voltam para os campos deste formulário (o cartão é `accountId`).
 */
export function quickEntrySchema(cardIds: ReadonlySet<string>) {
  return z
    .object({
      tipo: z.enum(TIPOS),
      valor: z.string(),
      data: z.string(),
      categoryId: z.string(),
      accountId: z.string(),
      descricao: z.string(),
      parcelas: z.string(),
      emCurso: z.boolean(),
      parcelaInicial: z.string(),
      pessoaId: z.string(),
      novaPessoa: z.string(),
      /** De quem é a compra no cartão: minha, de outra pessoa, ou dividida (parte minha + parte dela) */
      divisao: z.enum(DIVISOES),
      /** Compra dividida: a parte da pessoa (texto do campo, em reais) */
      partePessoa: z.string(),
    })
    .transform((input, ctx): QuickEntryValues => {
      const isCard = cardIds.has(input.accountId)
      if (isCard && input.tipo === 'receita') {
        ctx.addIssue({
          code: 'custom',
          path: ['accountId'],
          message: 'Uma receita entra numa conta, não num cartão.',
        })
        return z.NEVER
      }
      if (isCard && input.divisao !== 'minha' && input.pessoaId === '') {
        ctx.addIssue({ code: 'custom', path: ['pessoaId'], message: 'Escolha a pessoa.' })
        return z.NEVER
      }
      const result = isCard
        ? purchaseFormSchema.safeParse({
            ...input,
            cardId: input.accountId,
            // "Minha" ignora a pessoa que tenha ficado escolhida antes
            pessoaId: input.divisao === 'minha' ? '' : input.pessoaId,
          })
        : transactionFormSchema.safeParse(input)
      if (!result.success) {
        for (const issue of result.error.issues) {
          const [field] = issue.path
          ctx.addIssue({
            code: 'custom',
            path: [field === 'cardId' ? 'accountId' : (field ?? 'valor')],
            message: issue.message,
          })
        }
        return z.NEVER
      }
      if (!isCard) return { kind: 'transaction', values: result.data as TransactionFormValues }
      const values = result.data as PurchaseFormValues
      if (input.divisao !== 'dividida') return { kind: 'purchase', values }
      // Cada uma das duas compras precisa de pelo menos 1 centavo por parcela
      const parte = parseMoney(input.partePessoa)
      if (parte === null || parte < values.parcelas || parte > values.valor - values.parcelas) {
        ctx.addIssue({
          code: 'custom',
          path: ['partePessoa'],
          message: 'A parte da pessoa tem de ser menor que o total (e deixar parte para você).',
        })
        return z.NEVER
      }
      return { kind: 'split', values, valorPessoa: parte }
    })
}

export type QuickEntryInput = z.input<ReturnType<typeof quickEntrySchema>>
export type QuickEntryValues =
  | { kind: 'transaction'; values: TransactionFormValues }
  | { kind: 'purchase'; values: PurchaseFormValues }
  | { kind: 'split'; values: PurchaseFormValues; valorPessoa: number }
