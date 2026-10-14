-- Etapa 9: receitas e despesas.
-- Regras financeiras em docs/plano.md (valor sempre positivo em centavos; o sinal vem do tipo).

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null,
  category_id uuid not null,
  tipo public.tipo_movimento not null,
  -- Sempre positivo; MAX_CENTS de src/lib/money.ts
  valor_centavos bigint not null check (valor_centavos > 0 and valor_centavos <= 99999999999),
  -- Só a data (sem horas): evita problemas de fuso horário ao agrupar por dia e por mês.
  data date not null default current_date check (data between date '1900-01-01' and date '2999-12-31'),
  descricao text not null default ''
    check (char_length(descricao) <= 120 and descricao = trim(descricao)),
  created_at timestamptz not null default now(),

  -- FKs COMPOSTAS: a conta e a categoria têm de pertencer ao MESMO utilizador da transação.
  -- Mesmo conhecendo o id de uma conta alheia, a referência falha (e o erro não revela se ela existe).
  -- NO ACTION (e não RESTRICT): apagar uma conta/categoria com transações é recusado, mas a verificação
  -- acontece no fim da instrução, por isso apagar o utilizador (cascata em tudo) continua a funcionar.
  constraint transactions_account_fk foreign key (account_id, user_id)
    references public.accounts (id, user_id) on delete no action,
  constraint transactions_category_fk foreign key (category_id, user_id)
    references public.categories (id, user_id) on delete no action
);

comment on table public.transactions is 'Receitas e despesas; valor em centavos, sinal dado pelo tipo.';

-- Consultas por mês (lista e dashboard) e verificações das FKs.
create index transactions_user_data_idx on public.transactions (user_id, data desc, created_at desc);
create index transactions_account_idx on public.transactions (account_id);
create index transactions_category_idx on public.transactions (category_id);

alter table public.transactions enable row level security;
revoke all on table public.transactions from anon;

create policy "transactions: ler as próprias"
  on public.transactions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "transactions: criar para si"
  on public.transactions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "transactions: alterar as próprias"
  on public.transactions for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "transactions: apagar as próprias"
  on public.transactions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke update on table public.transactions from authenticated;
grant update (account_id, category_id, tipo, valor_centavos, data, descricao)
  on table public.transactions to authenticated;

-- A categoria tem de ser do mesmo tipo da transação (não há despesas na categoria "Salário").
-- security invoker (o padrão): corre com as permissões de quem escreve, por isso a RLS aplica-se.
create function public.check_transaction_category_tipo()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  categoria_tipo public.tipo_movimento;
begin
  select c.tipo into categoria_tipo
  from public.categories c
  where c.id = new.category_id and c.user_id = new.user_id;

  -- Categoria inexistente/alheia: deixa a FK composta recusar com o erro próprio (23503).
  if categoria_tipo is not null and categoria_tipo <> new.tipo then
    raise exception 'A categoria é de %, mas a transação é de %', categoria_tipo, new.tipo
      using errcode = '23514', constraint = 'transactions_category_tipo_check';
  end if;
  return new;
end;
$$;

create trigger transactions_check_category_tipo
  before insert or update of category_id, tipo on public.transactions
  for each row execute function public.check_transaction_category_tipo();
