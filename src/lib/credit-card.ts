// Cartões de crédito: datas das faturas, parcelamento e estado de uma fatura.
// Funções puras, em centavos inteiros e datas 'YYYY-MM-DD' (sem horas), como o resto de src/lib.
//
// Semântica (aprovada antes da implementação):
// - Uma fatura identifica-se pelo mês do VENCIMENTO (`mesReferencia`, 'YYYY-MM').
// - vencimento = dia V desse mês; fechamento = dia F no mesmo mês se V > F, ou no mês anterior se V < F.
//   Dias que o mês não tem passam ao último dia (F = 31 em fevereiro → 28 ou 29).
// - Ciclo da fatura = [inicioCiclo, fechamento): começa no fechamento da fatura anterior (inclusive) e
//   acaba no seu fechamento (exclusive). Uma compra feita no dia do fechamento vai para a fatura seguinte.
//   Os ciclos são contíguos: não há dias sem fatura nem dias em duas faturas.

import {
  addMonths,
  addMonthsClamped,
  daysBetween,
  isIsoDate,
  isMonthKey,
  lastDayOfMonth,
  monthOf,
  type IsoDate,
  type MonthKey,
} from './dates'
import { assertCents, MAX_CENTS } from './money'

/** Máximo de parcelas de uma compra. */
export const MAX_PARCELAS = 48

/** Datas aceites pela base de dados (CHECK de transactions.data). */
export const MIN_DATE: IsoDate = '1900-01-01'
export const MAX_DATE: IsoDate = '2999-12-31'

/** Prazos (dias entre fechamento e vencimento) fora deste intervalo geram um aviso, não um erro. */
export const PRAZO_AVISO_MIN = 5
export const PRAZO_AVISO_MAX = 25

export type CardConfig = {
  /** Dia do mês em que a fatura fecha (1–31) */
  diaFechamento: number
  /** Dia do mês em que a fatura vence (1–31) */
  diaVencimento: number
}

// ---------------------------------------------------------------------------------------------------
// Configuração do cartão

export type CardConfigField = 'diaFechamento' | 'diaVencimento' | 'limiteCentavos'
export type CardConfigIssue = { field: CardConfigField; message: string }

export type CardConfigValidation = {
  ok: boolean
  errors: CardConfigIssue[]
  /** Configurações válidas mas pouco habituais (confirmar com o banco) */
  warnings: CardConfigIssue[]
}

const isDay = (value: number) => Number.isInteger(value) && value >= 1 && value <= 31

/**
 * Regras da configuração:
 * - dias inteiros entre 1 e 31; limite inteiro entre 1 e MAX_CENTS centavos;
 * - fechamento ≠ vencimento (seria ambíguo: pagar no próprio dia ou um mês depois?);
 * - se V > F (fecha e vence no mesmo mês), F ≤ 27: com F ≥ 28, num fevereiro de 28 dias os dois dias
 *   passariam a 28 e o prazo para pagar seria 0. Com V < F o prazo é sempre positivo.
 * Equivale a exigir prazo > 0 em todos os meses (provado no teste exaustivo com paymentWindowDays).
 */
export function validateCardConfig({
  diaFechamento,
  diaVencimento,
  limiteCentavos,
}: CardConfig & { limiteCentavos: number }): CardConfigValidation {
  const errors = dayErrors({ diaFechamento, diaVencimento })
  const warnings: CardConfigIssue[] = []

  if (!Number.isSafeInteger(limiteCentavos) || limiteCentavos < 1 || limiteCentavos > MAX_CENTS) {
    errors.push({ field: 'limiteCentavos', message: 'Indica um limite de crédito válido.' })
  }
  if (errors.every((error) => error.field === 'limiteCentavos')) {
    const { min, max } = paymentWindowDays(diaFechamento, diaVencimento)
    if (min < PRAZO_AVISO_MIN || max > PRAZO_AVISO_MAX) {
      warnings.push({
        field: 'diaVencimento',
        message: `O prazo entre o fechamento e o vencimento varia entre ${min} e ${max} dias. Confirma com o teu banco.`,
      })
    }
  }

  return { ok: errors.length === 0, errors, warnings }
}

/** Erros dos dias (sem o limite nem os avisos): barato, usado também antes de cada cálculo de datas. */
function dayErrors({ diaFechamento, diaVencimento }: CardConfig): CardConfigIssue[] {
  const errors: CardConfigIssue[] = []
  if (!isDay(diaFechamento)) {
    errors.push({
      field: 'diaFechamento',
      message: 'O dia de fechamento tem de estar entre 1 e 31.',
    })
  }
  if (!isDay(diaVencimento)) {
    errors.push({
      field: 'diaVencimento',
      message: 'O dia de vencimento tem de estar entre 1 e 31.',
    })
  }
  if (isDay(diaFechamento) && isDay(diaVencimento)) {
    if (diaFechamento === diaVencimento) {
      errors.push({
        field: 'diaVencimento',
        message: 'O vencimento tem de ser num dia diferente do fechamento.',
      })
    } else if (diaVencimento > diaFechamento && diaFechamento >= 28) {
      errors.push({
        field: 'diaFechamento',
        message:
          'Com o fechamento no dia 28 ou depois, o vencimento tem de ser no mês seguinte (dia menor que o fechamento).',
      })
    }
  }
  return errors
}

function assertValidConfig(config: CardConfig): void {
  const errors = dayErrors(config)
  if (errors.length > 0) {
    throw new RangeError(
      `Configuração de cartão inválida: ${errors.map((e) => e.message).join(' ')}`,
    )
  }
}

// ---------------------------------------------------------------------------------------------------
// Datas das faturas

export type InvoiceDates = {
  mesReferencia: MonthKey
  /** Primeiro dia do ciclo (inclusive) = fechamento da fatura anterior */
  inicioCiclo: IsoDate
  /** Fim do ciclo (exclusive): compras a partir deste dia vão para a fatura seguinte */
  fechamento: IsoDate
  vencimento: IsoDate
}

/** Dia `day` do mês, ou o último dia se o mês for mais curto. */
function dayInMonth(month: MonthKey, day: number): IsoDate {
  const last = Number(lastDayOfMonth(month).slice(8, 10))
  return `${month}-${String(Math.min(day, last)).padStart(2, '0')}`
}

/** Mês do fechamento da fatura de referência `mesReferencia`. */
function closingMonth({ diaFechamento, diaVencimento }: CardConfig, mesReferencia: MonthKey) {
  return diaVencimento > diaFechamento ? mesReferencia : addMonths(mesReferencia, -1)
}

/** Sem validar a configuração: usado por paymentWindowDays, que também mede configurações inválidas. */
function rawInvoiceDates(config: CardConfig, mesReferencia: MonthKey): InvoiceDates {
  const fechamentoMes = closingMonth(config, mesReferencia)
  return {
    mesReferencia,
    inicioCiclo: dayInMonth(addMonths(fechamentoMes, -1), config.diaFechamento),
    fechamento: dayInMonth(fechamentoMes, config.diaFechamento),
    vencimento: dayInMonth(mesReferencia, config.diaVencimento),
  }
}

/** Datas da fatura que vence em `mesReferencia`. */
export function invoiceDates(config: CardConfig, mesReferencia: MonthKey): InvoiceDates {
  assertValidConfig(config)
  if (!isMonthKey(mesReferencia)) throw new RangeError(`Mês inválido: ${mesReferencia}`)
  return rawInvoiceDates(config, mesReferencia)
}

/** Anos que, juntos, têm todos os pares (mês anterior, mês) de comprimentos possíveis: 2027 normal, 2028 bissexto. */
const WINDOW_MONTHS: MonthKey[] = Array.from({ length: 24 }, (_, index) =>
  addMonths('2027-01', index),
)

/**
 * Prazo para pagar (dias de calendário do fechamento ao vencimento da mesma fatura), mínimo e máximo ao
 * longo do ano. Calcula as datas reais das 24 faturas de 2027 (ano normal) e 2028 (bissexto): juntos
 * cobrem todos os comprimentos de mês (28, 29, 30, 31) e todos os pares mês anterior → mês, que é tudo
 * o que influencia o prazo. Usa o mesmo cálculo de datas das faturas (sem uma fórmula à parte).
 * Aceita configurações inválidas (dias de 1 a 31) para os testes poderem medir porque são recusadas.
 */
export function paymentWindowDays(
  diaFechamento: number,
  diaVencimento: number,
): { min: number; max: number } {
  if (!isDay(diaFechamento) || !isDay(diaVencimento)) {
    throw new RangeError('Os dias de fechamento e vencimento têm de estar entre 1 e 31.')
  }
  const prazos = WINDOW_MONTHS.map((month) => {
    const { fechamento, vencimento } = rawInvoiceDates({ diaFechamento, diaVencimento }, month)
    return daysBetween(fechamento, vencimento)
  })
  return { min: Math.min(...prazos), max: Math.max(...prazos) }
}

/**
 * Fatura (mês de referência) de uma compra: a fatura cujo ciclo [inicioCiclo, fechamento) contém a data.
 * Compra no dia do fechamento → fatura seguinte.
 */
export function invoiceForPurchase(config: CardConfig, dataCompra: IsoDate): MonthKey {
  assertValidConfig(config)
  if (!isIsoDate(dataCompra)) throw new RangeError(`Data inválida: ${dataCompra}`)
  // A fatura cujo fechamento cai no mês da compra; se a compra é nesse dia ou depois, é a seguinte.
  const candidata =
    config.diaVencimento > config.diaFechamento
      ? monthOf(dataCompra)
      : addMonths(monthOf(dataCompra), 1)
  return dataCompra < rawInvoiceDates(config, candidata).fechamento
    ? candidata
    : addMonths(candidata, 1)
}

// ---------------------------------------------------------------------------------------------------
// Parcelamento

/**
 * Divide o total em `numeroParcelas` valores inteiros de centavos: todas as parcelas valem
 * floor(total / n) e a ÚLTIMA leva também o resto (menos de n centavos). A soma é exatamente o total.
 * Ex.: 100,00 em 3 → 33,33 + 33,33 + 33,34.
 */
export function splitInstallments(totalCentavos: number, numeroParcelas: number): number[] {
  assertCents(totalCentavos)
  if (totalCentavos < 1 || totalCentavos > MAX_CENTS) {
    throw new RangeError(`Valor total inválido: ${totalCentavos} (de 1 a ${MAX_CENTS} centavos)`)
  }
  if (!Number.isInteger(numeroParcelas) || numeroParcelas < 1 || numeroParcelas > MAX_PARCELAS) {
    throw new RangeError(`Número de parcelas inválido: ${numeroParcelas} (de 1 a ${MAX_PARCELAS})`)
  }
  if (totalCentavos < numeroParcelas) {
    throw new RangeError(
      `${totalCentavos} centavos não chegam para ${numeroParcelas} parcelas de pelo menos 1 centavo`,
    )
  }
  const base = Math.floor(totalCentavos / numeroParcelas)
  const resto = totalCentavos - base * numeroParcelas
  return Array.from({ length: numeroParcelas }, (_, index) =>
    index === numeroParcelas - 1 ? base + resto : base,
  )
}

export type Installment = {
  /** 1 a n */
  numero: number
  valorCentavos: number
  /** Data em que a parcela conta como consumo: data da compra + (numero − 1) meses, mesmo dia ou o último */
  data: IsoDate
  /** Fatura onde a parcela é cobrada: fatura da compra + (numero − 1) */
  mesFatura: MonthKey
}

export type InstallmentScheduleInput = {
  /** Data ORIGINAL da compra (também para compras já em curso) */
  dataCompra: IsoDate
  /** Valor ORIGINAL da compra */
  totalCentavos: number
  /** Número total de parcelas da compra */
  numeroParcelas: number
  /** Primeira parcela a registar (1 = compra nova; k > 1 = compra em curso, as anteriores já foram pagas) */
  parcelaInicial?: number
  config: CardConfig
}

/**
 * Parcelas `parcelaInicial`…`numeroParcelas` de uma compra. Os valores são os da divisão do total
 * ORIGINAL (as parcelas anteriores não aparecem, mas o arredondamento é o da compra completa).
 * `restanteCentavos` = soma das parcelas devolvidas (o que falta pagar desta compra).
 */
export function installmentSchedule({
  dataCompra,
  totalCentavos,
  numeroParcelas,
  parcelaInicial = 1,
  config,
}: InstallmentScheduleInput): { parcelas: Installment[]; restanteCentavos: number } {
  if (!isIsoDate(dataCompra) || dataCompra < MIN_DATE || dataCompra > MAX_DATE) {
    throw new RangeError(`Data da compra inválida: ${dataCompra}`)
  }
  const valores = splitInstallments(totalCentavos, numeroParcelas)
  if (!Number.isInteger(parcelaInicial) || parcelaInicial < 1 || parcelaInicial > numeroParcelas) {
    throw new RangeError(`Parcela inicial inválida: ${parcelaInicial} (de 1 a ${numeroParcelas})`)
  }
  const primeiraFatura = invoiceForPurchase(config, dataCompra)
  const ultimaFatura = addMonths(primeiraFatura, numeroParcelas - 1)
  if (rawInvoiceDates(config, ultimaFatura).vencimento > MAX_DATE) {
    throw new RangeError(`A última parcela venceria depois de ${MAX_DATE}`)
  }

  const parcelas: Installment[] = []
  let restanteCentavos = 0
  for (let numero = parcelaInicial; numero <= numeroParcelas; numero++) {
    const valorCentavos = valores[numero - 1]
    restanteCentavos += valorCentavos
    parcelas.push({
      numero,
      valorCentavos,
      data: addMonthsClamped(dataCompra, numero - 1),
      mesFatura: addMonths(primeiraFatura, numero - 1),
    })
  }
  return { parcelas, restanteCentavos }
}

// ---------------------------------------------------------------------------------------------------
// Estado de uma fatura

export type InvoiceState = 'aberta' | 'fechada' | 'vencida' | 'paga' | 'com_credito' | 'sem_compras'

export type InvoiceStatusInput = {
  fechamento: IsoDate
  vencimento: IsoDate
  /** Total da fatura (compras − estornos); negativo = crédito a favor */
  totalCentavos: number
  /** Σ pagamentos da fatura (≥ 0) */
  pagoCentavos: number
}

/**
 * Estado da fatura no dia `hoje` (regras pela ordem):
 * 1. hoje < fechamento → aberta (ainda recebe compras, mesmo que já tenha pagamentos);
 * 2. em aberto (total − pago) < 0 → com_credito (total negativo por estornos, ou pago a mais);
 * 3. total = 0 → sem_compras (aqui o pago também é 0);  4. em aberto = 0 → paga;
 * 5. hoje ≤ vencimento → fechada;  6. senão → vencida (inclui as pagas só em parte).
 * Recebe os totais já calculados: não sabe de onde vêm os pagamentos e os estornos.
 */
export function invoiceStatus(
  { fechamento, vencimento, totalCentavos, pagoCentavos }: InvoiceStatusInput,
  hoje: IsoDate,
): { estado: InvoiceState; emAbertoCentavos: number } {
  assertCents(totalCentavos)
  assertCents(pagoCentavos)
  if (pagoCentavos < 0) throw new RangeError(`Valor pago inválido: ${pagoCentavos}`)
  for (const date of [fechamento, vencimento, hoje]) {
    if (!isIsoDate(date)) throw new RangeError(`Data inválida: ${date}`)
  }
  if (fechamento >= vencimento) throw new RangeError('O fechamento tem de ser antes do vencimento.')

  const emAbertoCentavos = totalCentavos - pagoCentavos
  const estado: InvoiceState =
    hoje < fechamento
      ? 'aberta'
      : emAbertoCentavos < 0
        ? 'com_credito'
        : totalCentavos === 0
          ? 'sem_compras'
          : emAbertoCentavos === 0
            ? 'paga'
            : hoje <= vencimento
              ? 'fechada'
              : 'vencida'
  return { estado, emAbertoCentavos }
}
