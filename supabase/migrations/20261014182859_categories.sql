-- Etapa 7: categorias de receitas e despesas, por utilizador.
-- Receita de segurança em CLAUDE.md → "Segurança"; regras em docs/plano.md.

-- Enum (e não texto): o TypeScript gerado passa a conhecer os valores possíveis. Reutilizado pelas transações.
create type public.tipo_movimento as enum ('receita', 'despesa');

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 40 and nome = trim(nome)),
  -- O tipo não muda depois de criada (ver grants): as transações dependem dele.
  tipo public.tipo_movimento not null,
  -- Chaves da paleta e dos ícones definidas em src/features/categories/category-options.ts
  cor text not null default 'slate'
    check (cor in ('slate', 'red', 'orange', 'amber', 'green', 'teal', 'sky', 'blue', 'violet', 'pink')),
  icone text not null default 'tag' check (icone ~ '^[a-z0-9-]{1,40}$'),
  arquivada boolean not null default false,
  created_at timestamptz not null default now(),
  -- Alvo das FKs compostas (account/category + user_id) das transações: impede referências entre utilizadores.
  unique (id, user_id)
);

comment on table public.categories is 'Categorias de receita/despesa de cada utilizador.';

-- Nome único por utilizador e tipo, sem distinguir maiúsculas ("Lazer" = "lazer").
create unique index categories_nome_unico on public.categories (user_id, tipo, lower(nome));

alter table public.categories enable row level security;
revoke all on table public.categories from anon;

create policy "categories: ler as próprias"
  on public.categories for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "categories: criar para si"
  on public.categories for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "categories: alterar as próprias"
  on public.categories for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "categories: apagar as próprias"
  on public.categories for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Só estas colunas são editáveis; id, user_id, tipo e created_at ficam fixos.
revoke update on table public.categories from authenticated;
grant update (nome, cor, icone, arquivada) on table public.categories to authenticated;

-- Categorias iniciais de cada novo utilizador (o perfil é criado no registo por handle_new_user).
create function public.seed_default_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categories (user_id, nome, tipo, cor, icone)
  values
    (new.id, 'Alimentação', 'despesa', 'orange', 'utensils'),
    (new.id, 'Moradia', 'despesa', 'blue', 'house'),
    (new.id, 'Transporte', 'despesa', 'sky', 'car'),
    (new.id, 'Saúde', 'despesa', 'red', 'heart-pulse'),
    (new.id, 'Educação', 'despesa', 'teal', 'graduation-cap'),
    (new.id, 'Lazer', 'despesa', 'violet', 'party-popper'),
    (new.id, 'Compras', 'despesa', 'pink', 'shopping-bag'),
    (new.id, 'Contas e serviços', 'despesa', 'amber', 'receipt'),
    (new.id, 'Outras despesas', 'despesa', 'slate', 'tag'),
    (new.id, 'Salário', 'receita', 'green', 'briefcase'),
    (new.id, 'Investimentos', 'receita', 'teal', 'trending-up'),
    (new.id, 'Outras receitas', 'receita', 'slate', 'tag');
  return new;
end;
$$;

revoke execute on function public.seed_default_categories() from public, anon, authenticated;

create trigger on_profile_created_seed_categories
  after insert on public.profiles
  for each row execute function public.seed_default_categories();
