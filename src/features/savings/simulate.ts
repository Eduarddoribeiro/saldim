import { CDI, SELIC } from './rates'

// Simulação de "Guardar dinheiro" (pedido de 2026-11-25): quanto dá para guardar do que sobra dos
// fixos e quanto rende em cada aplicação comum, já sem imposto de renda. Taxas constantes durante
// todo o prazo (é uma estimativa, não uma promessa). Valores em centavos. Funções puras.

/** Parte da sobra sugerida para guardar; o resto fica para o dia a dia, que não entra nos fixos */
export const DEFAULT_SHARE = 0.3
/** Meses de gastos que a reserva de emergência deve cobrir */
export const RESERVE_MONTHS = 3

/** IR regressivo sobre o rendimento, pelo tempo que o dinheiro ficou aplicado (em dias corridos). */
export function incomeTax(days: number): number {
  if (days <= 180) return 0.225
  if (days <= 360) return 0.2
  if (days <= 720) return 0.175
  return 0.15
}

/** Taxa ao ano de uma aplicação que rende `fraction` do CDI (o CDI é diário, em dias úteis). */
export function percentOfCdi(fraction: number, cdi = CDI): number {
  const daily = Math.pow(1 + cdi, 1 / 252) - 1
  return Math.pow(1 + fraction * daily, 252) - 1
}

/**
 * Quanto se tem ao fim de `months` meses depositando `deposit` no início de cada mês, a `annual` ao
 * ano. Com `taxed`, cada depósito paga o IR do seu próprio prazo sobre o que rendeu.
 */
export function futureValue(deposit: number, months: number, annual: number, taxed: boolean) {
  const monthly = Math.pow(1 + annual, 1 / 12) - 1
  let total = 0
  for (let k = 0; k < months; k++) {
    const held = months - k
    const gain = deposit * Math.pow(1 + monthly, held) - deposit
    total += deposit + gain * (1 - (taxed ? incomeTax(held * 30) : 0))
  }
  return Math.round(total)
}

export type SavingsOption = {
  id: 'cdb' | 'lci' | 'tesouro' | 'poupanca'
  nome: string
  nota: string
  total: number
  rendimento: number
}

/** As aplicações comparadas, do que rende mais para o que rende menos. */
export function savingsOptions(deposit: number, months: number): SavingsOption[] {
  const put = deposit * months
  const options: Omit<SavingsOption, 'rendimento'>[] = [
    {
      id: 'cdb',
      nome: 'CDB 100% do CDI',
      nota: 'Bancos digitais. Escolha um com liquidez diária e garantia do FGC.',
      total: futureValue(deposit, months, CDI, true),
    },
    {
      id: 'lci',
      nome: 'LCI / LCA 90% do CDI',
      nota: 'Sem imposto, mas o dinheiro fica preso alguns meses (carência).',
      total: futureValue(deposit, months, percentOfCdi(0.9), false),
    },
    {
      id: 'tesouro',
      nome: 'Tesouro Selic',
      nota: 'Do governo. Bom para a reserva de emergência.',
      total: futureValue(deposit, months, SELIC, true),
    },
    {
      id: 'poupanca',
      nome: 'Poupança',
      nota: '0,5% ao mês (sem contar a TR). Rende menos que os outros.',
      total: futureValue(deposit, months, Math.pow(1.005, 12) - 1, false),
    },
  ]
  return options
    .map((option) => ({ ...option, rendimento: option.total - put }))
    .sort((a, b) => b.total - a.total)
}

/** Quanto guardar por mês: uma parte do que sobra (nunca negativo). */
export function monthlyDeposit(sobra: number, share: number): number {
  return Math.max(0, Math.round(sobra * share))
}

/**
 * Em quantos meses se chega a `goal` (já tendo `saved`) depositando `deposit` por mês num CDB 100% do
 * CDI. null se não houver depósito (nunca chega) ou se passar de 20 anos.
 */
export function monthsToReach(goal: number, saved: number, deposit: number): number | null {
  if (saved >= goal) return 0
  if (deposit <= 0) return null
  const monthly = Math.pow(1 + CDI, 1 / 12) - 1
  let total = saved
  for (let month = 1; month <= 240; month++) {
    total = (total + deposit) * (1 + monthly)
    if (total >= goal) return month
  }
  return null
}
