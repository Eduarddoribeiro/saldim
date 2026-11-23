import { describe, expect, it } from 'vitest'
import { matchAccountLines, matchCardLines, type ExistingPurchase } from './match'
import type { ImportLine } from './parse'

const line = (
  id: string,
  data: string,
  valor: number,
  parcela: [number, number] | null = null,
): ImportLine => ({
  id,
  data,
  descricao: id,
  valorCentavos: valor,
  sentido: 'saida',
  parcela: parcela ? { numero: parcela[0], total: parcela[1] } : null,
})
const purchase = (
  id: string,
  data: string,
  total: number,
  parcelas = 1,
  naPrimeira = true,
): ExistingPurchase => ({
  id,
  data_compra: data,
  valor_total_centavos: total,
  parcelas,
  centavos_na_primeira: naPrimeira,
})

describe('matchCardLines', () => {
  it('à vista: mesmo valor e data a ±2 dias; cada compra só serve uma linha', () => {
    const found = matchCardLines(
      [line('a', '2026-11-18', 5630), line('b', '2026-11-18', 5630), line('c', '2026-11-14', 5697)],
      [purchase('p1', '2026-11-19', 5630), purchase('p2', '2026-11-10', 5697)],
    )
    expect([...found]).toEqual(['a'])
  })

  it('parcelada: a parcela k da compra (pela data da compra ou dessa parcela)', () => {
    // Aliança: 8× de 40,00 desde 28/09; a fatura mostra "Parcela 3 de 8" com a data da compra
    const aliança = purchase('alianca', '2026-09-28', 32000, 8)
    expect([...matchCardLines([line('x', '2026-09-28', 4000, [3, 8])], [aliança])]).toEqual(['x'])
    // Outros bancos mostram a data da parcela (28/11)
    expect([...matchCardLines([line('y', '2026-11-28', 4000, [3, 8])], [aliança])]).toEqual(['y'])
    // Olá, Doutor (regra antiga: centavos na última): 3/3 = 19,68 no Saldim, 19,66 no banco
    const doutor = purchase('doutor', '2026-10-04', 5900, 3, false)
    expect([...matchCardLines([line('z', '2026-10-04', 1966, [3, 3])], [doutor])]).toEqual(['z'])
  })

  it('compra dividida: a minha metade + a da Mãe = a linha do banco', () => {
    const found = matchCardLines(
      [line('cafe', '2026-11-17', 3333, [1, 2])],
      [purchase('minha', '2026-11-17', 3332, 2), purchase('mae', '2026-11-17', 3334, 2)],
    )
    expect([...found]).toEqual(['cafe'])
  })

  it('linha nova: nada parecido no Saldim', () => {
    expect(
      matchCardLines([line('n', '2026-11-18', 5900)], [purchase('p', '2026-11-18', 5630)]).size,
    ).toBe(0)
  })
})

describe('matchAccountLines', () => {
  it('mesmo tipo, valor e data a ±1 dia', () => {
    const found = matchAccountLines(
      [line('a', '2026-11-17', 2590), { ...line('b', '2026-11-18', 650000), sentido: 'entrada' }],
      [
        { tipo: 'despesa', valor_centavos: 2590, data: '2026-11-16' },
        { tipo: 'despesa', valor_centavos: 650000, data: '2026-11-18' },
      ],
    )
    expect([...found]).toEqual(['a'])
  })
})
