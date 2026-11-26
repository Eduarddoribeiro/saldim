// Taxas usadas na simulação de "Guardar dinheiro". Não vêm de nenhum serviço: são as da última
// reunião do Copom e precisam de ser atualizadas à mão quando a Selic mudar.

/** Selic ao ano (Copom de 04/11/2026: mantida em 13,75%) */
export const SELIC = 0.1375
/** CDI ao ano: na prática, 0,10 ponto abaixo da Selic */
export const CDI = 0.1365
/** Data das taxas, para a interface dizer de quando são */
export const RATES_DATE = '2026-11-04'
