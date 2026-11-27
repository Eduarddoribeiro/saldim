import { z } from 'zod'
import { isIsoDate } from '@/lib/dates'
import { moneyField } from '@/lib/money-schema'

/** Transferência entre contas suas: de onde, para onde, valor, data (sem data futura) e nota. */
export function transferFormSchema(today: string) {
  return z
    .object({
      contaOrigemId: z.string().min(1, { error: 'Escolha de qual conta sai.' }),
      contaDestinoId: z.string().min(1, { error: 'Escolha para qual conta vai.' }),
      valor: moneyField({ positive: true }),
      data: z
        .string()
        .refine(isIsoDate, { error: 'Informe uma data válida.' })
        .refine((data) => data <= today, { error: 'Uma transferência não pode ter data futura.' }),
      descricao: z
        .string()
        .trim()
        .max(120, { error: 'A descrição pode ter no máximo 120 caracteres.' }),
    })
    .refine((values) => values.contaOrigemId !== values.contaDestinoId, {
      path: ['contaDestinoId'],
      error: 'Escolha uma conta diferente da de origem.',
    })
}

export type TransferFormInput = z.input<ReturnType<typeof transferFormSchema>>
export type TransferFormOutput = z.output<ReturnType<typeof transferFormSchema>>
