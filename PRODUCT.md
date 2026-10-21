# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Público em geral no Brasil, depois do deploy (etapa 14). Hoje o app ainda não está publicado e o único usuário é o autor.

Uso principal no **celular, no dia a dia**: registrar uma despesa logo depois de pagar e conferir o saldo, a fatura ou quanto alguém deve, em poucos segundos. O computador serve para revisões mais longas (faturas, orçamentos, o mês inteiro), mas não é o caso principal.

## Product Purpose

O Saldo é um app web de finanças pessoais, responsivo e sincronizado entre dispositivos (login com e-mail e senha). Permite registrar receitas e despesas por conta e categoria, acompanhar o saldo atual e o previsto, definir orçamentos mensais e ver os gastos por categoria.

Sucesso: a pessoa confia no número que vê. O saldo, a fatura e o que tem a receber batem com o banco e com o cartão de verdade, e registrar um gasto é rápido o bastante para ser feito na hora.

## Positioning

- **Cartão de crédito calculado como o cartão de verdade:** faturas pelos dias de fechamento e vencimento, compras parceladas (cada parcela na sua fatura), estornos, pagamento total ou parcial, mudança dos dias do cartão com histórico, e nenhuma despesa contada duas vezes (o pagamento da fatura não é despesa).
- **Compras de outras pessoas no seu cartão:** a compra conta na fatura e no limite, mas fica fora dos seus gastos e orçamentos. O app mostra quanto cada pessoa deve, o que já venceu e os reembolsos recebidos.
- **Simplicidade:** poucas telas e lançamento rápido, sem excesso de funcionalidades.

## Operating Context

- Navegação principal: Início, Transações, Faturas, Orçamentos, Configurações (barra inferior no celular, barra lateral a partir de 768px). Também "A receber" (`/a-receber`) e, nas Configurações, Categorias, Contas e Recorrentes.
- O mês escolhido fica no endereço (`?mes=AAAA-MM`) no Início, nas Transações e nos Orçamentos.
- Lançamentos recorrentes (assinaturas, aluguel, salário) são gerados automaticamente quando chega o dia, ao abrir o app.
- Tema claro, escuro ou do sistema.

## Capabilities and Constraints

- **Dinheiro:** valores sempre em centavos inteiros; moeda padrão BRL (`R$ 1.234,56`); EUR também é suportado, mas ainda não há tela para mudar a moeda.
- **Regras financeiras:** a fonte única é `docs/plano.md` (saldo atual × previsto, estados do orçamento, faturas, parcelas, estornos, a receber). O design não pode mudar o significado desses números.
- **Termos do produto:** receita, despesa, conta, cartão de crédito, fatura, parcela "k/n", estorno, orçamento, recorrente, "A receber", reembolso, dinheiro disponível, dívida nos cartões, saldo líquido, saldo previsto.
- **Stack existente:** React 19 + Vite + TypeScript, Tailwind v4 com tokens em `src/index.css`, shadcn (estilo `base-nova`, primitivas `@base-ui/react`), Recharts só nos gráficos do Início, Supabase (Postgres + RLS).
- **Em aberto:** filtros e pesquisa nas transações (etapa 13), deploy (etapa 14), login com Google, PWA, importar/exportar CSV, metas (etapa 15), Open Finance (etapa 16).

## Brand Commitments

- Nome: **Saldo** (`AppLogo.tsx`, `<title>`).
- **Idioma: português do Brasil**, tratando por "você" (Salvar, Excluir, Registrar). Toda a interface foi convertida de pt-PT para pt-BR.

## Evidence on Hand

- Nenhum usuário externo, depoimento, métrica de uso ou dado público ainda: o app não foi publicado. Não inventar números de usuários, avaliações nem clientes.
- Evidência técnica real: cerca de 545 testes automatizados (unitários, componentes, integração com RLS e E2E em desktop e celular).

## Product Principles

1. **O número tem que estar certo.** Exatidão financeira vem antes de qualquer efeito visual; cada número mostrado segue as regras de `docs/plano.md`.
2. **Celular primeiro, em segundos.** O caminho mais comum (registrar um gasto, ver o saldo) tem que caber numa mão e num momento curto.
3. **O cartão como ele é.** Fatura, parcelas e estornos seguem a lógica que a pessoa vê no extrato do banco, sem simplificações que gerem diferença.
4. **O que é seu e o que é dos outros fica separado.** Compras de terceiros aparecem na dívida e no limite, nunca nos seus gastos.
5. **Pouco, e bem feito.** Cada funcionalidade nova precisa justificar a tela ou o passo extra que traz.

## Accessibility & Inclusion

Práticas já adotadas no código, a manter:

- Estado do orçamento comunicado por cor + ícone + texto, nunca só por cor.
- Cores das séries dos gráficos validadas para daltonismo e contraste nos dois temas; cada gráfico tem `role="img"` com descrição e uma tabela alternativa.
- Layout verificado a 360px de largura, sem rolagem horizontal (testes E2E), e barra inferior respeitando a área segura do celular.
