import { z } from 'zod'
import { moneyField } from '@/lib/money-schema'
import { TIPOS_CONTA } from './account-options'

// Mesmos limites da base de dados (accounts.nome 1–40; saldo inicial em centavos, pode ser negativo).
export const accountFormSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, { error: 'Indica o nome da conta.' })
    .max(40, { error: 'O nome pode ter no máximo 40 caracteres.' }),
  tipo: z.enum(TIPOS_CONTA),
  // Texto no formulário → centavos ao validar
  saldoInicial: moneyField({ allowNegative: true }),
})

/** O que o formulário tem (texto) e o que sai depois de validado (centavos). */
export type AccountFormInput = z.input<typeof accountFormSchema>
export type AccountFormValues = z.output<typeof accountFormSchema>
