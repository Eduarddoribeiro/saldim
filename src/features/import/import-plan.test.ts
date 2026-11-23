import { describe, expect, it } from 'vitest'
import { actionFor, aliasesToSave, buildReviewRows } from './import-plan'
import { parseImportFile } from './parse'

const categories = [
  { id: 'alim', nome: 'Alimentação', tipo: 'despesa', arquivada: false },
  { id: 'outras', nome: 'Outras despesas', tipo: 'despesa', arquivada: false },
]

const fatura = parseImportFile(
  [
    'date,title,amount',
    '2026-11-18,Merc Acougue Autodromo,56.30',
    '2026-11-17,Mercadolivre - Parcela 1/2,33.33',
    '2026-11-15,Pagamento recebido,-908.53',
    '2026-09-28,Cn Aliancas Lt - Parcela 3/8,40.00',
  ].join('\n'),
).lines

describe('buildReviewRows (cartão)', () => {
  const rows = buildReviewRows({
    lines: fatura,
    isCard: true,
    accountId: 'picpay',
    purchases: [
      // A aliança já está no Saldim; uma compra noutro cartão não conta
      {
        id: 'al',
        account_id: 'picpay',
        data_compra: '2026-09-28',
        valor_total_centavos: 32000,
        parcelas: 8,
        centavos_na_primeira: true,
      },
      {
        id: 'x',
        account_id: 'nubank',
        data_compra: '2026-11-18',
        valor_total_centavos: 5630,
        parcelas: 1,
        centavos_na_primeira: true,
      },
    ],
    history: [
      {
        account_id: 'picpay',
        descricao: 'Merc Acougue Autodromo',
        category_id: 'alim',
        pessoa_id: 'mae',
        tipo: 'despesa',
        valor_centavos: 5697,
        data: '2026-11-14',
      },
    ],
    categories,
  })

  it('estado, seleção e sugestões de cada linha', () => {
    expect(rows.map((r) => [r.descricao, r.status, r.selecionada, r.categoryId, r.dono])).toEqual([
      ['Merc Acougue Autodromo', 'nova', true, 'alim', 'p:mae'],
      ['Mercadolivre', 'nova', true, 'outras', ''],
      ['Pagamento recebido', 'pagamento', false, '', ''],
      ['Cn Aliancas Lt', 'ja-registada', false, 'outras', ''],
    ])
  })

  it('a parcela vira a compra inteira a partir dela; dividida usa halfSplit', () => {
    expect(actionFor(rows[1], 'picpay', true)).toEqual({
      kind: 'purchase',
      values: expect.objectContaining({
        valor: 6666,
        parcelas: 2,
        parcelaInicial: 1,
        pessoaId: '',
      }),
    })
    expect(actionFor({ ...rows[1], dono: 'd:mae' }, 'picpay', true)).toEqual({
      kind: 'split',
      values: expect.objectContaining({ valor: 6666, pessoaId: 'mae', valorPessoa: 3334 }),
    })
    expect(actionFor(rows[0], 'picpay', true)).toMatchObject({
      kind: 'purchase',
      values: { valor: 5630, parcelas: 1, pessoaId: 'mae' },
    })
  })
})

describe('buildReviewRows (conta)', () => {
  it('entradas viram receitas; o que já está na conta não se seleciona', () => {
    const lines = parseImportFile(
      'Data,Valor,Identificador,Descrição\n17/11/2026,-25.90,a,Padaria\n18/11/2026,100.00,b,Pix recebido',
    ).lines
    const rows = buildReviewRows({
      lines,
      isCard: false,
      accountId: 'nubank',
      purchases: [],
      history: [
        {
          account_id: 'nubank',
          descricao: 'Padaria do bairro',
          category_id: 'alim',
          pessoa_id: null,
          tipo: 'despesa',
          valor_centavos: 2590,
          data: '2026-11-17',
        },
      ],
      categories: [
        ...categories,
        { id: 'outras-r', nome: 'Outras receitas', tipo: 'receita', arquivada: false },
      ],
    })
    expect(rows.map((r) => [r.status, r.selecionada])).toEqual([
      ['ja-registada', false],
      ['nova', true],
    ])
    expect(actionFor(rows[1], 'nubank', false)).toEqual({
      kind: 'transaction',
      values: {
        tipo: 'receita',
        valor: 10000,
        data: '2026-11-18',
        categoryId: 'outras-r',
        accountId: 'nubank',
        descricao: 'Pix recebido',
      },
    })
  })
})

describe('nomes lembrados', () => {
  const lines = parseImportFile(
    'date,title,amount\n2026-12-03,Mercadolivre - Parcela 1/3,25.00',
  ).lines

  it('o nome escolhido da última vez vem no lugar do do banco, com a categoria desse nome', () => {
    const [row] = buildReviewRows({
      lines,
      isCard: true,
      accountId: 'picpay',
      purchases: [],
      history: [
        {
          account_id: 'picpay',
          descricao: 'Café',
          category_id: 'alim',
          pessoa_id: 'mae',
          tipo: 'despesa',
          valor_centavos: 3332,
          data: '2026-11-17',
        },
      ],
      categories,
      aliases: [{ chave: 'mercadolivre', descricao: 'Café' }],
    })
    expect([row.descricao, row.descricaoBanco, row.categoryId, row.dono]).toEqual([
      'Café',
      'Mercadolivre',
      'alim',
      'p:mae',
    ])
    expect(actionFor(row, 'picpay', true).values.descricao).toBe('Café')
  })

  it('só se guardam os nomes mudados (um por descrição do banco)', () => {
    const [row] = buildReviewRows({
      lines,
      isCard: true,
      accountId: 'picpay',
      purchases: [],
      history: [],
      categories,
    })
    expect(aliasesToSave([row])).toEqual([])
    expect(
      aliasesToSave([
        { ...row, descricao: ' Café ' },
        { ...row, descricao: 'Moedor' },
      ]),
    ).toEqual([{ chave: 'mercadolivre', descricao: 'Moedor' }])
  })
})
