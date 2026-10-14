-- Etapa 8: contas (onde o dinheiro está: conta corrente, poupança, carteira…), por utilizador.
-- Receita de segurança em CLAUDE.md → "Segurança"; regras de saldo em docs/plano.md.

create type public.tipo_conta as enum ('corrente', 'poupanca', 'dinheiro', 'investimento', 'outra');

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 40 and nome = trim(nome)),
  tipo public.tipo_conta not null default 'corrente',
  -- Centavos inteiros; pode ser negativo (conta a descoberto). Limite = MAX_CENTS de src/lib/money.ts.
  saldo_inicial_centavos bigint not null default 0
    check (saldo_inicial_centavos between -99999999999 and 99999999999),
  arquivada boolean not null default false,
  created_at timestamptz not null default now(),
  -- Alvo da FK composta (account_id, user_id) das transações.
  unique (id, user_id)
);

comment on table public.accounts is 'Contas do utilizador; o saldo atual é calculado a partir das transações.';

create unique index accounts_nome_unico on public.accounts (user_id, lower(nome));

alter table public.accounts enable row level security;
revoke all on table public.accounts from anon;

create policy "accounts: ler as próprias"
  on public.accounts for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "accounts: criar para si"
  on public.accounts for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "accounts: alterar as próprias"
  on public.accounts for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "accounts: apagar as próprias"
  on public.accounts for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke update on table public.accounts from authenticated;
grant update (nome, tipo, saldo_inicial_centavos, arquivada) on table public.accounts to authenticated;

-- Cada utilizador novo começa com uma conta, para poder registar transações logo.
create function public.seed_default_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.accounts (user_id, nome, tipo) values (new.id, 'Conta principal', 'corrente');
  return new;
end;
$$;

revoke execute on function public.seed_default_account() from public, anon, authenticated;

create trigger on_profile_created_seed_account
  after insert on public.profiles
  for each row execute function public.seed_default_account();
