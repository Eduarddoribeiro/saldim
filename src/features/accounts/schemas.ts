import { z } from 'zod'
import { validateCardConfig } from '@/lib/credit-card'
import { moneyField } from '@/lib/money-schema'
import { TIPOS_CONTA } from './account-options'

/** Configuração de um cartão de crédito, já validada (as mesmas regras do CHECK da base de dados). */
export type CardSettings = {
  diaFechamento: number
  diaVencimento: number
  limiteCentavos: number
  contaPagamentoId: string
}

const saldoInicialField = moneyField({ allowNegative: true })
const limiteField = moneyField({ positive: true })

// Mesmos limites da base de dados (accounts.nome 1–40; saldo inicial em centavos, pode ser negativo).
// Os campos do cartão só são validados quando o tipo é cartão; os do outro tipo são ignorados (o
// formulário esconde-os, por isso um valor antigo lá escrito não pode impedir de guardar).
export const accountFormSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(1, { error: 'Indica o nome da conta.' })
      .max(40, { error: 'O nome pode ter no máximo 40 caracteres.' }),
    tipo: z.enum(TIPOS_CONTA),
    // Texto no formulário → centavos ao validar
    saldoInicial: z.string(),
    // Cartão: dias escolhidos numa lista ('' = ainda não escolhido), limite em texto, conta de pagamento
    diaFechamento: z.string(),
    diaVencimento: z.string(),
    limite: z.string(),
    contaPagamentoId: z.string(),
  })
  .transform((input, ctx) => {
    const fail = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', message, path: [path] })

    if (input.tipo !== 'cartao_credito') {
      const saldo = saldoInicialField.safeParse(input.saldoInicial)
      if (!saldo.success) {
        fail('saldoInicial', saldo.error.issues[0].message)
        return z.NEVER
      }
      return { nome: input.nome, tipo: input.tipo, saldoInicial: saldo.data, cartao: null }
    }

    let valid = true
    const day = (text: string, path: string, message: string) => {
      if (text === '') {
        fail(path, message)
        valid = false
      }
      return Number(text)
    }
    const diaFechamento = day(input.diaFechamento, 'diaFechamento', 'Escolhe o dia de fechamento.')
    const diaVencimento = day(input.diaVencimento, 'diaVencimento', 'Escolhe o dia de vencimento.')
    const limite = limiteField.safeParse(input.limite)
    if (!limite.success) {
      fail('limite', limite.error.issues[0].message)
      valid = false
    }
    if (input.contaPagamentoId === '') {
      fail('contaPagamentoId', 'Escolhe a conta de onde sai o pagamento da fatura.')
      valid = false
    }
    if (input.diaFechamento !== '' && input.diaVencimento !== '') {
      // Só os erros dos dias: o limite já foi validado acima, com mensagens do campo de dinheiro
      const { errors } = validateCardConfig({ diaFechamento, diaVencimento, limiteCentavos: 1 })
      for (const error of errors) {
        fail(error.field, error.message)
        valid = false
      }
    }
    if (!valid || !limite.success) return z.NEVER

    const cartao: CardSettings = {
      diaFechamento,
      diaVencimento,
      limiteCentavos: limite.data,
      contaPagamentoId: input.contaPagamentoId,
    }
    // Um cartão começa sem dívida: a dívida vem das compras (CHECK accounts_cartao_campos_check)
    return { nome: input.nome, tipo: input.tipo, saldoInicial: 0, cartao }
  })

/** O que o formulário tem (texto) e o que sai depois de validado (centavos, dias como números). */
export type AccountFormInput = z.input<typeof accountFormSchema>
export type AccountFormValues = z.output<typeof accountFormSchema>
