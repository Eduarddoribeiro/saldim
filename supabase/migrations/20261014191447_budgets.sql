-- Etapa 12: orçamentos mensais por categoria de despesa.
-- Regras em docs/plano.md: um por (utilizador, categoria, mês); limite > 0; só categorias de despesa.

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null,
  -- 1.º dia do mês a que o orçamento se aplica
  mes date not null check (extract(day from mes) = 1),
  limite_centavos bigint not null check (limite_centavos > 0 and limite_centavos <= 99999999999),
  created_at timestamptz not null default now(),
  unique (user_id, category_id, mes),
  -- FK composta: só categorias do próprio utilizador. CASCADE: apagar uma categoria (sem transações)
  -- apaga os seus orçamentos — um orçamento não tem significado sem a categoria.
  constraint budgets_category_fk foreign key (category_id, user_id)
    references public.categories (id, user_id) on delete cascade
);

comment on table public.budgets is 'Limite mensal de gastos por categoria de despesa (centavos).';

create index budgets_user_mes_idx on public.budgets (user_id, mes);
create index budgets_category_idx on public.budgets (category_id);

alter table public.budgets enable row level security;
revoke all on table public.budgets from anon;

create policy "budgets: ler os próprios"
  on public.budgets for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "budgets: criar para si"
  on public.budgets for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "budgets: alterar os próprios"
  on public.budgets for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "budgets: apagar os próprios"
  on public.budgets for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Só o limite muda; para outra categoria/mês cria-se outro orçamento.
revoke update on table public.budgets from authenticated;
grant update (limite_centavos) on table public.budgets to authenticated;

-- Orçamentos só fazem sentido para despesas.
create function public.check_budget_category_tipo()
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

  if categoria_tipo is not null and categoria_tipo <> 'despesa' then
    raise exception 'Orçamentos só podem ser definidos para categorias de despesa'
      using errcode = '23514', constraint = 'budgets_category_tipo_check';
  end if;
  return new;
end;
$$;

create trigger budgets_check_category_tipo
  before insert on public.budgets
  for each row execute function public.check_budget_category_tipo();
