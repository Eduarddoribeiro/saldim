import { z } from 'zod'
import { isIsoDate } from '@/lib/dates'
import { moneyField } from '@/lib/money-schema'
import { TIPOS } from '@/features/categories/schemas'

// Mesmas regras da base de dados (transactions): valor > 0, descrição até 120, data válida.
export const transactionFormSchema = z.object({
  tipo: z.enum(TIPOS),
  valor: moneyField({ positive: true }),
  data: z.string().refine(isIsoDate, { error: 'Indica uma data válida.' }),
  categoryId: z.string().min(1, { error: 'Escolhe uma categoria.' }),
  accountId: z.string().min(1, { error: 'Escolhe uma conta.' }),
  descricao: z
    .string()
    .trim()
    .max(120, { error: 'A descrição pode ter no máximo 120 caracteres.' }),
})

export type TransactionFormInput = z.input<typeof transactionFormSchema>
export type TransactionFormValues = z.output<typeof transactionFormSchema>
