-- Etapa 4: perfil de cada utilizador (1:1 com auth.users).
-- Regras de segurança em docs/plano.md → "Segurança (Supabase)".

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '' check (char_length(nome) <= 80),
  -- Moeda de apresentação. Valores guardados sempre em centavos (ver docs/plano.md).
  moeda text not null default 'BRL' check (moeda in ('BRL', 'EUR')),
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Perfil do utilizador; criado automaticamente no registo.';

-- RLS: sem política, ninguém vê nada. Cada utilizador só lê e altera o seu próprio perfil.
alter table public.profiles enable row level security;

-- Defesa em profundidade: o papel anónimo nem sequer tem permissão sobre a tabela.
revoke all on table public.profiles from anon;

-- `(select auth.uid())` em vez de `auth.uid()`: o Postgres calcula-o uma vez por consulta, não por linha.
create policy "profiles: ler o próprio"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: alterar o próprio"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Sem políticas de INSERT/DELETE: o perfil é criado pelo trigger abaixo e apagado em cascata com a conta.

-- O id e a data de criação não podem ser alterados pelo utilizador.
revoke update on table public.profiles from authenticated;
grant update (nome, moeda) on table public.profiles to authenticated;

-- Cria o perfil quando alguém se regista. `security definer` porque o utilizador ainda não tem
-- sessão nesse momento; `search_path = ''` evita que a função use objetos de outro schema por engano.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, left(coalesce(trim(new.raw_user_meta_data ->> 'nome'), ''), 80));
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
