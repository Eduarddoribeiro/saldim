-- Nomes escolhidos na importação (docs/features/importar.md, pedido de 2026-11-23): quando o banco diz
-- "Mercadolivre" e o utilizador lhe chama "Café", guarda-se esse nome para a próxima importação já o
-- sugerir (e, a partir dele, a categoria e a pessoa usadas da última vez). Uma linha por descrição do
-- banco (normalizada pela app: minúsculas, sem acentos nem números).

create table public.nomes_importacao (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Descrição do banco normalizada (aliasKey em src/features/import/suggest.ts)
  chave text not null check (char_length(chave) between 1 and 120),
  -- O nome que o utilizador escolheu
  descricao text not null check (char_length(descricao) between 1 and 120 and descricao = trim(descricao)),
  updated_at timestamptz not null default now(),

  constraint nomes_importacao_chave_unica unique (user_id, chave)
);

comment on table public.nomes_importacao is
  'Nome que o utilizador deu a uma descrição do banco ao importar, para a próxima importação o sugerir.';

alter table public.nomes_importacao enable row level security;

create policy "nomes_importacao: ler os próprios"
  on public.nomes_importacao for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "nomes_importacao: criar para si"
  on public.nomes_importacao for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "nomes_importacao: alterar os próprios"
  on public.nomes_importacao for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "nomes_importacao: apagar os próprios"
  on public.nomes_importacao for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.nomes_importacao from anon, authenticated;
grant select, delete on table public.nomes_importacao to authenticated;
-- upsert (insert ... on conflict do update) escreve as duas colunas
grant insert (chave, descricao) on table public.nomes_importacao to authenticated;
grant update (chave, descricao, updated_at) on table public.nomes_importacao to authenticated;
