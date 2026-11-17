import { z } from 'zod'
import { purchaseFormSchema, type PurchaseFormValues } from '@/features/card-purchases/schemas'
import { TIPOS } from '@/features/categories/schemas'
import { transactionFormSchema, type TransactionFormValues } from '@/features/transactions/schemas'

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
      const result = isCard
        ? purchaseFormSchema.safeParse({ ...input, cardId: input.accountId })
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
      return isCard
        ? { kind: 'purchase', values: result.data as PurchaseFormValues }
        : { kind: 'transaction', values: result.data as TransactionFormValues }
    })
}

export type QuickEntryInput = z.input<ReturnType<typeof quickEntrySchema>>
export type QuickEntryValues =
  | { kind: 'transaction'; values: TransactionFormValues }
  | { kind: 'purchase'; values: PurchaseFormValues }
