import { z } from 'zod'
import { isIsoDate, type IsoDate } from '@/lib/dates'
import { moneyField } from '@/lib/money-schema'

// Mesmas regras da base de dados (pessoas, reembolsos). A base volta a verificar tudo.

export const personFormSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, { error: 'Informe o nome.' })
    .max(60, { error: 'O nome pode ter no máximo 60 caracteres.' }),
  /** D23: o que já devia antes de as compras estarem na app (0 se nada) */
  dividaAnterior: moneyField(),
})

export type PersonFormInput = z.input<typeof personFormSchema>
export type PersonFormValues = z.output<typeof personFormSchema>

/** Pagamento recebido de uma pessoa: valor > 0, conta de dinheiro, sem data futura (`today`). */
export function reimbursementFormSchema(today: IsoDate) {
  return z.object({
    valor: moneyField({ positive: true }),
    accountId: z.string().min(1, { error: 'Escolha a conta onde entrou o dinheiro.' }),
    data: z
      .string()
      .refine(isIsoDate, { error: 'Informe uma data válida.', abort: true })
      .refine((date) => date <= today, {
        error: 'Um pagamento recebido não pode ter data futura.',
      }),
    descricao: z
      .string()
      .trim()
      .max(120, { error: 'A descrição pode ter no máximo 120 caracteres.' }),
  })
}

export type ReimbursementFormSchema = ReturnType<typeof reimbursementFormSchema>
export type ReimbursementFormInput = z.input<ReimbursementFormSchema>
export type ReimbursementFormOutput = z.output<ReimbursementFormSchema>
