import { describe, expect, it } from 'vitest'
import { detectInstallment, ImportError, parseAmount, parseCsv, parseImportFile } from './parse'

describe('parseImportFile', () => {
  it('fatura do cartão do Nubank: compras saem, pagamentos entram; parcelas detetadas', () => {
    const csv = [
      'date,title,amount',
      '2026-11-18,Merc Acougue Autodromo,56.30',
      '2026-11-17,Mercadolivre - Parcela 1/2,33.33',
      '2026-11-15,Pagamento recebido,-908.53',
      '"2026-11-14","Loja, com vírgula",10',
    ].join('\n')
    const { formato, lines } = parseImportFile(csv)
    expect(formato).toBe('nubank-cartao')
    expect(lines.map((l) => [l.data, l.descricao, l.valorCentavos, l.sentido, l.parcela])).toEqual([
      ['2026-11-18', 'Merc Acougue Autodromo', 5630, 'saida', null],
      ['2026-11-17', 'Mercadolivre', 3333, 'saida', { numero: 1, total: 2 }],
      ['2026-11-15', 'Pagamento recebido', 90853, 'entrada', null],
      ['2026-11-14', 'Loja, com vírgula', 1000, 'saida', null],
    ])
  })

  it('extrato da conta do Nubank: valor negativo é saída', () => {
    const csv =
      '\uFEFFData,Valor,Identificador,Descrição\r\n17/11/2026,-25.90,abc,Compra no débito - Padaria\r\n18/11/2026,6500.00,def,Transferência recebida\r\n'
    const { formato, lines } = parseImportFile(csv)
    expect(formato).toBe('nubank-conta')
    expect(lines.map((l) => [l.data, l.valorCentavos, l.sentido])).toEqual([
      ['2026-11-17', 2590, 'saida'],
      ['2026-11-18', 650000, 'entrada'],
    ])
  })

  it('OFX (Itaú, Caixa): TRNAMT negativo é saída; descrição do MEMO ou NAME', () => {
    const ofx = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261117120000[-3:BRT]<TRNAMT>-40,00<FITID>A1<MEMO>CN ALIANCAS LT PARC 03/08
</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261110<TRNAMT>1200.00<FITID>A2<NAME>SALARIO
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`
    const { formato, lines } = parseImportFile(ofx)
    expect(formato).toBe('ofx')
    expect(lines).toEqual([
      {
        id: 'A1',
        data: '2026-11-17',
        descricao: 'CN ALIANCAS LT',
        valorCentavos: 4000,
        sentido: 'saida',
        parcela: { numero: 3, total: 8 },
      },
      {
        id: 'A2',
        data: '2026-11-10',
        descricao: 'SALARIO',
        valorCentavos: 120000,
        sentido: 'entrada',
        parcela: null,
      },
    ])
  })

  it('formato desconhecido ou linha estragada: erro com mensagem clara', () => {
    expect(() => parseImportFile('a,b,c\n1,2,3')).toThrow(ImportError)
    expect(() => parseImportFile('date,title,amount\nontem,X,10')).toThrow(/Linha 2/)
  })
})

describe('detectInstallment', () => {
  it('reconhece as formas dos bancos e limpa a descrição', () => {
    expect(detectInstallment('Mercadolivre*mparc01/02')).toEqual({
      descricao: 'Mercadolivre',
      parcela: { numero: 1, total: 2 },
    })
    expect(detectInstallment('Pg *ola Doutor Parcela 3 de 3').parcela).toEqual({
      numero: 3,
      total: 3,
    })
    expect(detectInstallment('Jim.com* 46005 05/05').parcela).toEqual({ numero: 5, total: 5 })
  })

  it('não confunde com outras coisas', () => {
    expect(detectInstallment('Uber 99').parcela).toBeNull()
    expect(detectInstallment('Loja 5/3').parcela).toBeNull() // parcela maior que o total
    expect(detectInstallment('Loja 1/1').parcela).toBeNull() // à vista
  })
})

describe('parseAmount e parseCsv', () => {
  it('lê os formatos de valor dos bancos', () => {
    expect(parseAmount('56.30')).toBe(5630)
    expect(parseAmount('-1.234,56')).toBe(-123456)
    expect(parseAmount('1,234.56')).toBe(123456)
    expect(parseAmount('R$ 10')).toBe(1000)
    expect(parseAmount('12,5')).toBe(1250)
    expect(parseAmount('abc')).toBeNull()
  })

  it('CSV com ponto e vírgula e aspas', () => {
    expect(parseCsv('a;b\n"x;y";"z ""q"""')).toEqual([
      ['a', 'b'],
      ['x;y', 'z "q"'],
    ])
  })
})
