# A pessoa vê o que deve, na conta dela

**Status:** Fases 1–3 feitas (local); falta a fase 4 (produção)
**Projeto:** Saldim · **Branch:** feat/partilhar-divida · **Criado em:** 2026-11-17

## Contexto

Quem usa a app regista compras da mãe no seu cartão (pessoa "Mãe" em A receber, T1). Hoje só quem usa a app vê o que ela deve; a mãe pergunta e é preciso mandar prints. A ideia: a mãe entra no Saldim com a conta dela e vê, sempre atualizado, o que deve, mês a mês, e o que já pagou.

Classificação: **funcionalidade nova** (não está no plano). É a primeira vez que um utilizador vê dados de outro: toca na regra mais importante da app (cada um só vê o que é seu).

## Decisões já tomadas (2026-11-17)

- A mãe usa o Saldim **só para ver o que deve** (não para as finanças dela).
- **Só leitura:** ela não altera nem apaga nada; o "Recebi" continua do lado de quem empresta o cartão.
- **Ligação por link de convite:** em A receber, "Convidar" gera um link; ela abre, cria conta (ou entra) e fica ligada. Quem convidou pode desligar a qualquer momento.

## Objetivo e definição de pronto

- No cartão da Mãe em A receber há "Compartilhar com Mãe" → link para enviar (WhatsApp).
- A mãe abre o link, cria a conta, e cai numa página **"O que eu devo"**: total, já vencido, próximas faturas mês a mês (as mesmas contas que A receber já faz), compras e pagamentos recebidos.
- Uma compra nova para a Mãe aparece-lhe ao abrir a página (sem fazer nada).
- Ela **não** vê nada que não seja dela: nem saldos, nem outras compras, nem as outras pessoas, nem os limites dos cartões. Provado por testes RLS com três utilizadores.
- "Deixar de compartilhar" corta o acesso na hora.

## Avaliação

- **Impacto no que existe:** nada muda para quem já usa a app se não convidar ninguém. Mudam as políticas RLS de `pessoas`, `compras_cartao`, `transactions`, `faturas` e `reembolsos` (uma política de leitura nova em cada, aditiva).
- **Riscos:**
  1. **Expor dados a outra pessoa (o maior).** Mitigação: políticas só de SELECT, sempre por `pessoa_id` ligada a `auth.uid()`, nunca por `user_id`; testes com dono, mãe e um terceiro; o `schema-guard` continua igual.
  2. **Nomes dos cartões e categorias:** para mostrar "Nubank · parcela 2/3" a mãe precisaria de ler linhas de `accounts`/`categories` (que trazem limite, dias, etc.). **Proposta:** não abrir essas tabelas; a compra guarda só o que ela precisa ver (ver Fase 1) ou a página mostra só a descrição.
  3. **Aceitar o convite** obriga a escrever na linha `pessoas` do dono, o que a RLS não permite à mãe. Precisa de uma função `security definer` num esquema privado chamada por uma função `public` normal; é exatamente o que o `schema-guard` vigia, por isso tem de ser revista com cuidado (token aleatório de uso único, expira em 7 dias, só preenche `viewer_id` vazio).
  4. **Produção:** as migrations têm de ser aplicadas no Supabase da cloud (o do Vercel). Só com o teu sim, com backup antes.
- **Esforço:** **G** (uma semana ou mais): migrations + RLS + testes de isolamento a três, convite, página nova, e2e com dois browsers.
- **MVP proposto:** sem notificações, sem "Paguei" do lado dela, uma só pessoa ligada por conta.
- **Alternativa sem código:** um link "só leitura" público com token (sem conta). Mais simples, mas quem tiver o link vê tudo; não recomendado para dados financeiros.
- **Recomendação:** seguir com o MVP.

## Regras de negócio

1. Uma pessoa (`pessoas`) tem no máximo **um** utilizador ligado (`viewer_id`); uma conta pode estar ligada a várias pessoas (a mãe pode dever a dois filhos).
2. Quem está ligado **só lê**: a pessoa, as compras dela, as parcelas e estornos com o `pessoa_id` dela, as faturas dessas parcelas (só datas) e os reembolsos dela.
3. Convite: token aleatório (32 bytes), uso único, expira em 7 dias; gerar outro invalida o anterior.
4. Desligar apaga `viewer_id` e os convites; o acesso cai no próximo pedido.
5. Arquivar ou apagar a pessoa também corta o acesso.
6. Os cálculos são os mesmos de A receber (`receivables`, `upcomingByMonth`), sem cópia de regras.

## O que mudou em relação ao plano (decidido na implementação)

- **Sem políticas RLS novas nas tabelas do dono.** Em vez de abrir `pessoas`, `compras_cartao`, `transactions`, `faturas` e `reembolsos` à leitura de quem está ligado, tudo sai de **uma** função, `divida_partilhada()`, que escolhe as colunas à mão (das contas só `id` e `nome` dos cartões das compras dela; das categorias só nome, cor e ícone). Resolve o risco 2: limites, dias, saldos e outras compras nunca saem da base de dados.
- As funções que passam a RLS (`aceitar_convite`, `deixar_de_compartilhar`, `divida_partilhada`) são `security definer` no esquema `private` (não exposto pela API) e chamadas por funções `public` `security invoker`. O `schema-guard` ficou igual; um teste novo confirma que nada de `private` é executável por `anon`.
- O nome que a mãe vê ("Você deve a …") é o nome do perfil de quem convida; o diálogo de partilha permite mudá-lo.
- Convite aberto sem sessão: o token fica guardado (`saldim-convite-pendente`) e a app volta a ele depois de criar a conta ou entrar (também se houver confirmação por e-mail).
- Quem só usa o Saldim para isto (sem lançamentos próprios) vai direto para "O que eu devo" ao abrir a app, uma vez por sessão; no Início há um atalho "Você deve a …".

## Fases

1. ✅ **Base de dados e RLS** (migration `partilhar_divida`): `pessoas.viewer_id`, tabela `convites_pessoa`, funções de convite/aceitar/desligar, políticas de leitura. Testes RLS a três utilizadores (dono, mãe, intruso) e do convite (expirado, reutilizado, de outra pessoa). Decidir aqui como mostrar nomes de cartões (risco 2). — _Pronto quando_ `npm run test:rls` passa com os testes novos.
2. ✅ **Convite na interface:** em A receber, "Compartilhar" (gera e copia o link, mostra o estado "Ligada a …" e "Deixar de compartilhar"); rota pública `/convite/:token` que manda criar conta ou entrar e depois aceita. — _Pronto quando_ e2e: dono convida, mãe aceita, dono vê "Ligada".
3. ✅ **Página "O que eu devo"** (`/o-que-devo`): para quem está ligado, total, já vencido, próximas faturas, compras e pagamentos, reaproveitando `UpcomingInvoices` e as funções puras. Uma conta sem lançamentos próprios abre direto nesta página. — _Pronto quando_ e2e com dois browsers: compra nova do dono aparece à mãe; depois de desligar, ela não vê nada.
4. **Produção** (só com autorização): backup, aplicar a migration no Supabase da cloud, publicar.

**Reversão:** a migration é aditiva; para voltar atrás, `viewer_id = null` em todas as pessoas desliga tudo, e uma migration de reversão remove as políticas novas.

## Fora do escopo (para depois)

- A mãe marcar "Paguei" para tu confirmares.
- Notificações (e-mail/push) de compra nova.
- A mãe usar o Saldim para as finanças dela com as compras a entrarem como gastos dela.
