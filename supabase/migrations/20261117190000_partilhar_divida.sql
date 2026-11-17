-- A pessoa vê o que deve, na conta dela (docs/features/mae-ve-o-que-deve.md).
--
-- Quem usa a app (o "dono") convida uma pessoa de A receber com um link. Quem abre o link e entra
-- fica ligado a essa pessoa (`pessoas.viewer_id`) e passa a LER, e só ler, o que ela deve: as
-- compras dela, as parcelas e estornos, as datas das faturas, os nomes dos cartões e das categorias
-- dessas compras, os pagamentos que fez e a dívida anterior.
--
-- Decisão de segurança: nenhuma tabela do dono ganha políticas novas. Tudo o que a pessoa ligada vê
-- sai de UMA função (`divida_partilhada`), que escolhe as colunas à mão. Assim os saldos, as outras
-- compras, as outras pessoas e os limites dos cartões nunca saem da base de dados.
--
-- As funções que precisam de passar a RLS (aceitar um convite escreve na linha `pessoas` do dono;
-- ler a dívida lê tabelas do dono) são `security definer` no esquema `private`, que a API não expõe.
-- A API só vê as funções de `public`, todas `security invoker`, que as chamam. O `schema-guard`
-- continua a garantir que não há funções `security definer` em `public`.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 1. Ligação pessoa ↔ utilizador

-- Quem lê o que esta pessoa deve. Sem grant de update: só muda pelas funções abaixo (aceitar um
-- convite, deixar de compartilhar). Apagar a conta de quem lê desliga-o.
alter table public.pessoas
  add column viewer_id uuid references auth.users (id) on delete set null;

create index pessoas_viewer_idx on public.pessoas (viewer_id) where viewer_id is not null;

-- Quem lê não pode ser o próprio dono
alter table public.pessoas
  add constraint pessoas_viewer_check check (viewer_id is null or viewer_id <> user_id);

-- ---------------------------------------------------------------------------------------------------
-- 2. Convites

-- Um convite por pessoa (gerar outro substitui o anterior). Guarda-se só o hash do token: quem ler a
-- tabela não consegue usar o link.
create table public.convites_pessoa (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pessoa_id uuid not null,
  token_hash text not null unique,
  expira_em timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),

  constraint convites_pessoa_unica unique (pessoa_id),
  constraint convites_pessoa_fk foreign key (pessoa_id, user_id)
    references public.pessoas (id, user_id) on delete cascade
);

comment on table public.convites_pessoa is
  'Convite (link) para uma pessoa de A receber ver o que deve na conta dela. Só o hash do token.';

alter table public.convites_pessoa enable row level security;

create policy "convites_pessoa: ler os próprios"
  on public.convites_pessoa for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "convites_pessoa: apagar os próprios"
  on public.convites_pessoa for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Criar só pela função criar_convite_pessoa (gera o token na base de dados)
create policy "convites_pessoa: criar para si"
  on public.convites_pessoa for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

revoke all on table public.convites_pessoa from anon, authenticated;
grant select, delete on table public.convites_pessoa to authenticated;
grant insert (pessoa_id, token_hash) on table public.convites_pessoa to authenticated;

-- Gera um convite para uma pessoa do utilizador e devolve o token (só desta vez: guarda-se o hash).
-- security invoker: a RLS garante que a pessoa é de quem chama (FK composta + políticas).
create function public.criar_convite_pessoa(p_pessoa_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_token text;
begin
  if not exists (
    select 1 from public.pessoas
    where id = p_pessoa_id and user_id = (select auth.uid()) and not arquivada
  ) then
    raise exception 'pessoa inexistente ou arquivada' using errcode = 'P0002',
      hint = 'convite_pessoa_invalida';
  end if;
  -- 2 × 122 bits aleatórios (gen_random_uuid é v4, de um gerador criptográfico)
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  delete from public.convites_pessoa where pessoa_id = p_pessoa_id;
  insert into public.convites_pessoa (pessoa_id, token_hash)
  values (p_pessoa_id, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'));
  return v_token;
end;
$$;

revoke all on function public.criar_convite_pessoa(uuid) from public, anon;
grant execute on function public.criar_convite_pessoa(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 3. Aceitar e desligar (security definer, no esquema privado)

create function private.aceitar_convite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_convite public.convites_pessoa%rowtype;
  v_pessoa public.pessoas%rowtype;
begin
  if v_uid is null then
    raise exception 'sem sessão' using errcode = '42501';
  end if;
  select * into v_convite from public.convites_pessoa
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
  for update;
  if not found or v_convite.expira_em < now() then
    raise exception 'convite inválido ou expirado' using errcode = 'P0002',
      hint = 'convite_invalido';
  end if;
  select * into v_pessoa from public.pessoas where id = v_convite.pessoa_id for update;
  if v_pessoa.user_id = v_uid then
    raise exception 'o dono não pode aceitar o próprio convite' using errcode = '23514',
      hint = 'convite_proprio';
  end if;
  if v_pessoa.viewer_id is not null and v_pessoa.viewer_id <> v_uid then
    raise exception 'pessoa já ligada a outra conta' using errcode = '23514',
      hint = 'convite_ja_usado';
  end if;
  update public.pessoas set viewer_id = v_uid where id = v_pessoa.id;
  -- Uso único
  delete from public.convites_pessoa where id = v_convite.id;
  return v_pessoa.id;
end;
$$;

-- Desliga quem lê: pode chamá-la o dono da pessoa ou quem está ligado (sair).
create function private.deixar_de_compartilhar(p_pessoa_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  update public.pessoas set viewer_id = null
  where id = p_pessoa_id and (user_id = v_uid or viewer_id = v_uid);
  if not found then
    raise exception 'pessoa inexistente' using errcode = 'P0002', hint = 'convite_pessoa_invalida';
  end if;
  delete from public.convites_pessoa where pessoa_id = p_pessoa_id and user_id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------------------------------------
-- 4. O que a pessoa ligada vê

-- Uma linha por pessoa ligada a quem chama (pode dever a mais de uma conta). Só as colunas escolhidas.
create function private.divida_partilhada()
returns table (
  pessoa_id uuid,
  pessoa_nome text,
  dono_nome text,
  divida_anterior_centavos bigint,
  compras jsonb,
  movimentos jsonb,
  faturas jsonb,
  cartoes jsonb,
  categorias jsonb,
  reembolsos jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.nome,
    coalesce(nullif(pr.nome, ''), ''),
    p.divida_anterior_centavos,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'account_id', c.account_id, 'category_id', c.category_id,
        'descricao', c.descricao, 'data_compra', c.data_compra,
        'valor_total_centavos', c.valor_total_centavos, 'parcelas', c.parcelas,
        'parcela_inicial', c.parcela_inicial, 'pessoa_id', c.pessoa_id
      ) order by c.data_compra, c.id)
      from public.compras_cartao c where c.pessoa_id = p.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'tipo', t.tipo, 'valor_centavos', t.valor_centavos, 'data', t.data,
        'account_id', t.account_id, 'fatura_id', t.fatura_id, 'compra_id', t.compra_id,
        'pessoa_id', t.pessoa_id
      ) order by t.data, t.id)
      from public.transactions t where t.pessoa_id = p.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'data_vencimento', f.data_vencimento))
      from public.faturas f
      where f.id in (select t.fatura_id from public.transactions t where t.pessoa_id = p.id)
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome))
      from public.accounts a
      where a.id in (select c.account_id from public.compras_cartao c where c.pessoa_id = p.id)
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', k.id, 'nome', k.nome, 'cor', k.cor, 'icone', k.icone
      ))
      from public.categories k
      where k.id in (select c.category_id from public.compras_cartao c where c.pessoa_id = p.id)
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'valor_centavos', r.valor_centavos, 'data', r.data, 'descricao', r.descricao
      ) order by r.data, r.id)
      from public.reembolsos r where r.pessoa_id = p.id
    ), '[]'::jsonb)
  from public.pessoas p
  left join public.profiles pr on pr.id = p.user_id
  where p.viewer_id = auth.uid() and auth.uid() is not null and not p.arquivada
  order by p.nome;
$$;

revoke all on function private.aceitar_convite(text) from public, anon;
revoke all on function private.deixar_de_compartilhar(uuid) from public, anon;
revoke all on function private.divida_partilhada() from public, anon;
grant execute on function private.aceitar_convite(text) to authenticated;
grant execute on function private.deixar_de_compartilhar(uuid) to authenticated;
grant execute on function private.divida_partilhada() to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 5. Portas de entrada da API (public, security invoker)

create function public.aceitar_convite(p_token text)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select private.aceitar_convite(p_token) $$;

create function public.deixar_de_compartilhar(p_pessoa_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.deixar_de_compartilhar(p_pessoa_id) $$;

create function public.divida_partilhada()
returns table (
  pessoa_id uuid,
  pessoa_nome text,
  dono_nome text,
  divida_anterior_centavos bigint,
  compras jsonb,
  movimentos jsonb,
  faturas jsonb,
  cartoes jsonb,
  categorias jsonb,
  reembolsos jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.divida_partilhada() $$;

revoke all on function public.aceitar_convite(text) from public, anon;
revoke all on function public.deixar_de_compartilhar(uuid) from public, anon;
revoke all on function public.divida_partilhada() from public, anon;
grant execute on function public.aceitar_convite(text) to authenticated;
grant execute on function public.deixar_de_compartilhar(uuid) to authenticated;
grant execute on function public.divida_partilhada() to authenticated;
