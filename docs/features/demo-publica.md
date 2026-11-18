# Demo pública (portefólio)

**Status:** Código feito e testado localmente; falta criar o projeto Supabase e o projeto Vercel da demo.
**Criado em:** 2026-11-18

## Objetivo

Um endereço para o portefólio onde qualquer pessoa experimenta o Saldim **sem cadastro**, com dados inventados, sem ver nem mexer na conta de quem desenvolve a app.

## Como funciona

- A demo é **outra instalação** da mesma app (mesmo repositório), com `VITE_DEMO=true` e o seu **próprio projeto Supabase**. Os dados reais nunca estão na mesma base de dados.
- No login aparece "Explorar a demonstração". Um toque cria uma **conta anónima** do Supabase (sem e-mail nem senha), só desse visitante.
- Ao abrir a app, `DemoSetup` vê que a conta está vazia e preenche-a com `seedDemoData` (`src/features/demo/demo-seed.ts`): 6 meses de dados relativos a hoje (Marina, conta Nubank e poupança, dois cartões, parcelas, assinaturas, recorrentes, a irmã Ana em A receber, faturas pagas, orçamentos). Mostra uma barra de progresso e depois a faixa "Demonstração com dados fictícios".
- Cada visitante tem a sua cópia: pode registar, apagar e pagar à vontade sem estragar a demo de ninguém. As regras são as mesmas da app (RLS, triggers, RPCs); `tests/rls/demo-seed.test.ts` prova-o com uma conta anónima.
- Os mesmos dados alimentam `npm run demo:seed` (capturas do README), que agora importa `demo-seed.ts`.

## Instalar (uma vez)

1. **Supabase:** criar um projeto novo (ex.: `saldim-demo`, plano grátis).
2. **Base de dados da demo:** no computador, na pasta do projeto:
   ```
   npx supabase link --project-ref <id do projeto DA DEMO>
   npx supabase db push
   npx supabase link --project-ref <id do projeto REAL>
   ```
   O último comando volta a ligar a pasta ao projeto real, para o próximo `db push` não ir para a demo por engano.
3. **Login anónimo:** no painel da demo, Authentication → Sign In / Providers → ligar **Allow anonymous sign-ins**. (Opcional: Authentication → Attack Protection → CAPTCHA, contra robôs.)
4. **Vercel:** Add New → Project → importar o mesmo repositório `saldim` → nome `saldim-demo` → Environment Variables:
   - `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`: do projeto **da demo** (Project Settings → API; a chave **pública**, nunca a secreta);
   - `VITE_DEMO` = `true`.

   Deploy. O endereço (ex.: `saldim-demo.vercel.app`) é o do portefólio.

5. **README:** trocar o link "Demo" pelo endereço novo.

## Manutenção

As contas anónimas ficam na base de dados da demo. Para não crescer para sempre, apagar as antigas (apaga os dados delas em cascata). No painel da demo, SQL Editor:

```sql
delete from auth.users where is_anonymous and created_at < now() - interval '7 days';
```

Pode agendar-se em Integrations → Cron (diário).

## Decisões

- **Conta anónima por visitante, não uma conta partilhada com senha pública:** ninguém estraga a demo dos outros e não há senha à vista.
- **Projeto Supabase separado:** a app real não aceita logins anónimos nem recebe tráfego de visitantes; o limite do plano grátis da demo não afeta os dados reais.
- **Dados preenchidos no browser** (pelo cliente normal) em vez de uma função SQL: reutiliza o mesmo código do `demo:seed` e passa pelas mesmas regras que a app.

## Fora do escopo

- Repor a demo de um visitante (basta sair e entrar de novo: é uma conta nova).
- Tour guiado pela app.
