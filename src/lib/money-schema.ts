import { z } from 'zod'
import { parseMoney } from './money'

export const MONEY_EXAMPLE = 'Ex.: 1.234,56'

/**
 * Campo de formulário com dinheiro: entra texto (o que a pessoa escreveu), sai centavos inteiros.
 * - `allowNegative`: aceita "-50,00" (ex.: saldo inicial de uma conta a descoberto)
 * - `positive`: exige valor > 0 (ex.: valor de uma transação)
 */
export function moneyField(options: { allowNegative?: boolean; positive?: boolean } = {}) {
  return z.string().transform((text, ctx) => {
    if (text.trim() === '') {
      ctx.addIssue({ code: 'custom', message: 'Indica o valor.' })
      return z.NEVER
    }
    const cents = parseMoney(text, { allowNegative: options.allowNegative })
    if (cents === null) {
      const negativeHint =
        !options.allowNegative && /^\s*[-−]/.test(text) ? ' Não pode ser negativo.' : ''
      ctx.addIssue({ code: 'custom', message: `Valor inválido.${negativeHint} ${MONEY_EXAMPLE}` })
      return z.NEVER
    }
    if (options.positive && cents <= 0) {
      ctx.addIssue({ code: 'custom', message: 'O valor tem de ser maior que zero.' })
      return z.NEVER
    }
    return cents
  })
}
