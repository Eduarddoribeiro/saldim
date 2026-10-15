import { z } from 'zod'
import { MAX_DATE, MAX_PARCELAS, MIN_DATE } from '@/lib/credit-card'
import { isIsoDate } from '@/lib/dates'
import { moneyField } from '@/lib/money-schema'

// Mesmas regras da base de dados (compras_cartao): valor ≥ 1 centavo por parcela, 1 a 48 parcelas,
// parcela inicial entre 1 e o total, data entre 1900 e 2999, descrição até 120 caracteres.
// A base de dados volta a verificar tudo: isto só dá mensagens claras antes de enviar.

/** Inteiro vindo de um <select> (texto). */
const wholeNumber = z.string().transform((text, ctx) => {
  const value = Number(text)
  if (text === '' || !Number.isInteger(value)) {
    ctx.addIssue({ code: 'custom', message: 'Escolhe um número.' })
    return z.NEVER
  }
  return value
})

export const purchaseFormSchema = z
  .object({
    cardId: z.string().min(1, { error: 'Escolhe o cartão.' }),
    valor: moneyField({ positive: true }),
    parcelas: wholeNumber,
    data: z.string().refine((data) => isIsoDate(data) && data >= MIN_DATE && data <= MAX_DATE, {
      error: 'Indica uma data válida.',
    }),
    categoryId: z.string().min(1, { error: 'Escolhe uma categoria.' }),
    descricao: z
      .string()
      .trim()
      .max(120, { error: 'A descrição pode ter no máximo 120 caracteres.' }),
    /** Compra feita antes de começar a usar a app, com parcelas já pagas (D5a) */
    emCurso: z.boolean(),
    parcelaInicial: wholeNumber,
  })
  .superRefine((values, ctx) => {
    if (values.parcelas < 1 || values.parcelas > MAX_PARCELAS) {
      ctx.addIssue({
        code: 'custom',
        path: ['parcelas'],
        message: `De 1 a ${MAX_PARCELAS} parcelas.`,
      })
    } else if (values.valor < values.parcelas) {
      ctx.addIssue({
        code: 'custom',
        path: ['valor'],
        message: 'O valor não chega para todas as parcelas (1 centavo cada).',
      })
    }
    if (values.emCurso && (values.parcelaInicial < 2 || values.parcelaInicial > values.parcelas)) {
      ctx.addIssue({
        code: 'custom',
        path: ['parcelaInicial'],
        message:
          values.parcelas < 2
            ? 'Uma compra em curso tem pelo menos 2 parcelas.'
            : `Escolhe uma parcela entre 2 e ${values.parcelas}.`,
      })
    }
  })
  // Compra nova = começa na parcela 1, mesmo que o campo escondido tenha outro valor
  .transform(({ emCurso, parcelaInicial, ...values }) => ({
    ...values,
    parcelaInicial: emCurso ? parcelaInicial : 1,
  }))

export type PurchaseFormInput = z.input<typeof purchaseFormSchema>
export type PurchaseFormValues = z.output<typeof purchaseFormSchema>
