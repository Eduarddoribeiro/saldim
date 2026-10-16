import { z } from 'zod'
import { TIPOS } from '@/features/categories/schemas'
import { isIsoDate, type IsoDate } from '@/lib/dates'
import { moneyField } from '@/lib/money-schema'

// Mesmas regras da base de dados (recorrencias): valor > 0, nome obrigatório até 120, mensal ou anual,
// próxima data não passada (D18). `today` é a data local de quem preenche.
export function recurringFormSchema(today: IsoDate) {
  return z.object({
    tipo: z.enum(TIPOS),
    valor: moneyField({ positive: true }),
    descricao: z
      .string()
      .trim()
      .min(1, { error: 'Indica um nome (ex.: Netflix).' })
      .max(120, { error: 'O nome pode ter no máximo 120 caracteres.' }),
    accountId: z.string().min(1, { error: 'Escolhe uma conta.' }),
    categoryId: z.string().min(1, { error: 'Escolhe uma categoria.' }),
    frequencia: z.enum(['mensal', 'anual']),
    proximaData: z
      .string()
      .refine(isIsoDate, { error: 'Indica uma data válida.', abort: true })
      .refine((date) => date >= today, { error: 'A próxima data não pode ser no passado.' }),
  })
}

export type RecurringFormSchema = ReturnType<typeof recurringFormSchema>
export type RecurringFormInput = z.input<RecurringFormSchema>
export type RecurringFormOutput = z.output<RecurringFormSchema>
