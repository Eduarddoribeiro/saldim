import { z } from 'zod'
import { MIN_DATE } from '@/lib/credit-card'
import { isIsoDate, todayIso } from '@/lib/dates'
import { moneyField } from '@/lib/money-schema'

// Pagamento de uma fatura. Mesmas regras da base de dados (transferencias): valor > 0, sem data
// futura (D10a — aqui exata, com o "hoje" local), descrição até 120 caracteres.
export const paymentFormSchema = z.object({
  contaOrigemId: z.string().min(1, { error: 'Escolhe a conta de onde sai o dinheiro.' }),
  valor: moneyField({ positive: true }),
  data: z
    .string()
    .refine((data) => isIsoDate(data) && data >= MIN_DATE, { error: 'Indica uma data válida.' })
    .refine((data) => data <= todayIso(), { error: 'Um pagamento não pode ter data futura.' }),
  descricao: z
    .string()
    .trim()
    .max(120, { error: 'A descrição pode ter no máximo 120 caracteres.' }),
})

export type PaymentFormInput = z.input<typeof paymentFormSchema>
export type PaymentFormValues = z.output<typeof paymentFormSchema>
