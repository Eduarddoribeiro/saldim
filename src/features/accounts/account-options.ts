import {
  Banknote,
  CreditCard,
  Landmark,
  PiggyBank,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { Constants, type Enums } from '@/lib/database.types'

export type TipoConta = Enums<'tipo_conta'>

// Lista gerada a partir do enum da base de dados: se a base ganhar um tipo novo, o TypeScript obriga a
// acrescentá-lo aqui (o Record exige todas as chaves).
export const TIPOS_CONTA = Constants.public.Enums.tipo_conta

export const TIPO_CONTA_OPTIONS: Record<TipoConta, { label: string; icon: LucideIcon }> = {
  corrente: { label: 'Conta corrente', icon: Landmark },
  poupanca: { label: 'Poupança', icon: PiggyBank },
  dinheiro: { label: 'Dinheiro', icon: Banknote },
  investimento: { label: 'Investimentos', icon: TrendingUp },
  outra: { label: 'Outra', icon: Wallet },
  cartao_credito: { label: 'Cartão de crédito', icon: CreditCard },
}

/** Cartões têm regras próprias (fatura, limite, conta de pagamento): ver src/lib/credit-card.ts. */
export function isCreditCard(account: { tipo: TipoConta }): boolean {
  return account.tipo === 'cartao_credito'
}
