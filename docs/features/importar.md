# Importar extratos e faturas

**Status:** Fases 1 e 2 feitas; fase 3 (Picpay pelo conector) a seguir
**Pedido:** 2026-11-23 — "toda hora esqueço de anotar algo e daí o app perde a importância"

## Objetivo

Registar de uma vez o que veio do banco, em vez de lançamento a lançamento: escolhe-se a conta ou o cartão, o ficheiro do banco, revê-se a lista (só as linhas que ainda não estão no Saldim) e confirma-se.

## Formatos (decididos com o utilizador)

| Origem                    | Formato                                                                          | Como se lê                                                         |
| ------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Nubank — fatura do cartão | CSV `date,title,amount`                                                          | `amount` > 0 = compra; < 0 = pagamento/crédito (não se importa)    |
| Nubank — extrato da conta | CSV `Data,Valor,Identificador,Descrição`                                         | `Valor` < 0 = saída; > 0 = entrada                                 |
| Itaú, Caixa e outros      | OFX (`<STMTTRN>`)                                                                | `TRNAMT` < 0 = saída; > 0 = entrada; descrição de `MEMO` ou `NAME` |
| Picpay                    | o Claude lê pelo conector do Picpay e gera um CSV no formato da fatura do Nubank | igual ao Nubank                                                    |

## Regras

1. **Parcelas:** "Parcela 1 de 2", "Parcela 1/2", "mparc01/02", "PARC 03/08" → compra parcelada inteira (valor da parcela × n), a partir dessa parcela (compra em curso, D5a). As seguintes já ficam nas próximas faturas: não se importam de novo.
2. **Duplicados (cartão):** uma linha já está no Saldim se houver uma compra no mesmo cartão com o mesmo número de parcelas, data da compra a ±2 dias (ou a data dessa parcela) e a parcela k com o mesmo valor (±2 centavos) — também somando duas compras (a minha + a da Mãe, compra dividida).
3. **Duplicados (conta):** mesma conta, mesmo tipo, mesmo valor e data a ±1 dia. Cada lançamento do Saldim só "apaga" uma linha.
4. **Pagamentos e créditos no cartão** aparecem, mas não se importam (o pagamento regista-se em Cartões → Pagar).
5. **Categoria sugerida:** a de um lançamento antigo com a mesma descrição (aprende com o uso); senão, por palavras (mercado/açougue/ifood → Alimentação; uber/posto → Transporte; farmácia → Saúde…); senão "Outras despesas"/"Outras receitas". A pessoa (Minha / Mãe / Dividida) também vem do histórico.
6. Cada linha regista-se pelas funções de sempre (`registar_compra_cartao`, `registar_compra_dividida`, inserção de transação), com as mesmas regras da base de dados; uma linha que falhe mostra o erro e não trava as outras.

## Fases

1. Leitura dos formatos, deteção de parcelas, duplicados e sugestões — funções puras com testes (`src/features/import/`).
2. Página `/importar` (atalhos no Extrato e em Cartões): escolher destino, ficheiro, rever (categoria, pessoa, descrição), importar; testes de componentes e e2e.
3. Picpay pelo conector: o Claude gera o CSV a partir da fatura.

## Fora do escopo

Open Finance (Etapa 16), estornos importados, importação automática agendada.
