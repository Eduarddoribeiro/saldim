-- Etapa T1: compras no cartão de outras pessoas e o que elas devem (D19–D22 em docs/plano.md).
--
-- Uma compra no cartão pode ser de outra pessoa (ex.: a mãe). Conta na fatura, na dívida do cartão e
-- no limite (é dívida real do cartão), mas não nas despesas, nas categorias nem nos orçamentos de quem
-- usa a app. O que cada pessoa deve = as suas compras − os estornos − o que já devolveu (reembolsos).
-- Migration incremental: tabelas novas e colunas opcionais; nada é apagado nem recalculado.

-- ---------------------------------------------------------------------------------------------------
-- 1. Pessoas

create table public.pessoas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null,
  arquivada boolean not null default false,
  created_at timestamptz not null default now(),

  constraint pessoas_nome_check check (char_length(nome) between 1 and 60 and nome = trim(nome)),
  -- Alvo das FKs compostas (a compra/reembolso é do mesmo utilizador da pessoa)
  constraint pessoas_id_user_key unique (id, user_id)
);

-- Nome único por utilizador, sem distinguir maiúsculas ("Mãe" = "mãe")
create unique index pessoas_user_nome_key on public.pessoas (user_id, lower(nome));

comment on table public.pessoas is
  'Pessoas que fazem compras no cartão de quem usa a app (e lhe devolvem o dinheiro).';

alter table public.pessoas enable row level security;

create policy "pessoas: ler as próprias"
  on public.pessoas for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "pessoas: criar para si"
  on public.pessoas for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "pessoas: alterar as próprias"
  on public.pessoas for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "pessoas: apagar as próprias"
  on public.pessoas for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.pessoas from anon, authenticated;
grant select, delete on table public.pessoas to authenticated;
grant insert (nome) on table public.pessoas to authenticated;
grant update (nome, arquivada) on table public.pessoas to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 2. Compras de outra pessoa

-- D19: a compra (e por isso as suas parcelas e estornos) é de uma pessoa; null = de quem usa a app.
-- NO ACTION: uma pessoa com compras não se apaga (arquiva-se); apagar o utilizador continua a funcionar.
alter table public.compras_cartao
  add column pessoa_id uuid,
  add constraint compras_cartao_pessoa_fk foreign key (pessoa_id, user_id)
    references public.pessoas (id, user_id) on delete no action;

create index compras_cartao_pessoa_idx on public.compras_cartao (pessoa_id)
  where pessoa_id is not null;

grant insert (pessoa_id) on table public.compras_cartao to authenticated;

-- As parcelas e os estornos levam a pessoa da compra (copiada pela trigger abaixo): os cálculos e as
-- listas usam-na sem juntar tabelas. Só as transações de uma compra a podem ter.
alter table public.transactions
  add column pessoa_id uuid,
  add constraint transactions_pessoa_fk foreign key (pessoa_id, user_id)
    references public.pessoas (id, user_id) on delete no action,
  add constraint transactions_pessoa_check check (pessoa_id is null or compra_id is not null);

create index transactions_pessoa_idx on public.transactions (pessoa_id)
  where pessoa_id is not null;

-- A pessoa de uma parcela ou estorno é SEMPRE a da compra (o valor enviado é ignorado). Não há
-- grant de update nesta coluna, e as compras não se alteram: fica certa para sempre.
create function public.set_transaction_pessoa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.compra_id is null then
    new.pessoa_id := null;
  else
    select c.pessoa_id into new.pessoa_id
    from public.compras_cartao c
    where c.id = new.compra_id and c.user_id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger transactions_set_pessoa
  before insert on public.transactions
  for each row execute function public.set_transaction_pessoa();

-- A compra regista-se como antes, agora com a pessoa (opcional, no fim: as chamadas antigas, como a
-- de gerar_recorrencias, continuam válidas). A assinatura muda, por isso a função antiga sai.
drop function public.registar_compra_cartao(uuid, uuid, date, bigint, integer, integer, text);

create function public.registar_compra_cartao(
  p_account_id uuid,
  p_category_id uuid,
  p_data_compra date,
  p_valor_total_centavos bigint,
  p_parcelas integer,
  p_parcela_inicial integer default 1,
  p_descricao text default '',
  p_pessoa_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_compra_id uuid;
  v_fatura_id uuid;
  v_primeira_fatura date;
  v_mes date;
begin
  -- As regras da compra (cartão do utilizador, categoria de despesa, valor, parcelas, datas, pessoa
  -- do utilizador) são verificadas pelas constraints e triggers das tabelas.
  insert into public.compras_cartao (
    account_id, category_id, descricao, data_compra, valor_total_centavos, parcelas, parcela_inicial,
    pessoa_id
  ) values (
    p_account_id, p_category_id, coalesce(p_descricao, ''), p_data_compra, p_valor_total_centavos,
    p_parcelas, coalesce(p_parcela_inicial, 1), p_pessoa_id
  )
  returning id into v_compra_id;

  v_primeira_fatura := public.cartao_fatura_da_compra_conta(p_account_id, p_data_compra);

  for numero in coalesce(p_parcela_inicial, 1) .. p_parcelas loop
    v_mes := (v_primeira_fatura + make_interval(months => numero - 1))::date;

    insert into public.faturas (account_id, mes_referencia)
    values (p_account_id, v_mes)
    on conflict (account_id, mes_referencia) do nothing;

    select f.id into strict v_fatura_id
    from public.faturas f
    where f.account_id = p_account_id and f.mes_referencia = v_mes;

    -- pessoa_id vem da compra (trigger transactions_set_pessoa)
    insert into public.transactions (
      account_id, category_id, tipo, valor_centavos, data, descricao,
      fatura_id, compra_id, parcela_numero
    ) values (
      p_account_id, p_category_id, 'despesa',
      public.cartao_valor_parcela(p_valor_total_centavos, p_parcelas, numero),
      public.cartao_data_parcela(p_data_compra, numero),
      coalesce(p_descricao, ''), v_fatura_id, v_compra_id, numero
    );
  end loop;

  return v_compra_id;
end;
$$;

revoke all on function public.registar_compra_cartao(uuid, uuid, date, bigint, integer, integer, text, uuid)
  from public, anon;
grant execute on function public.registar_compra_cartao(uuid, uuid, date, bigint, integer, integer, text, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 3. Reembolsos: o que uma pessoa devolve

-- D21: dinheiro que entra numa conta de dinheiro e abate ao que a pessoa deve. Não é receita (não
-- conta nos relatórios); só mexe no saldo da conta. Sem update: corrige-se apagando e registando.
create table public.reembolsos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pessoa_id uuid not null,
  account_id uuid not null,
  -- MAX_CENTS de src/lib/money.ts
  valor_centavos bigint not null check (valor_centavos between 1 and 99999999999),
  data date not null check (data between date '1900-01-01' and date '2999-12-31'),
  descricao text not null default ''
    check (char_length(descricao) <= 120 and descricao = trim(descricao)),
  created_at timestamptz not null default now(),

  constraint reembolsos_pessoa_fk foreign key (pessoa_id, user_id)
    references public.pessoas (id, user_id) on delete no action,
  constraint reembolsos_account_fk foreign key (account_id, user_id)
    references public.accounts (id, user_id) on delete no action
);

comment on table public.reembolsos is
  'Dinheiro devolvido por uma pessoa (entra numa conta de dinheiro; não é receita).';

create index reembolsos_user_data_idx on public.reembolsos (user_id, data, id);
create index reembolsos_pessoa_idx on public.reembolsos (pessoa_id);
create index reembolsos_account_idx on public.reembolsos (account_id);

alter table public.reembolsos enable row level security;

create policy "reembolsos: ler os próprios"
  on public.reembolsos for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "reembolsos: criar para si"
  on public.reembolsos for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "reembolsos: apagar os próprios"
  on public.reembolsos for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.reembolsos from anon, authenticated;
grant select, delete on table public.reembolsos to authenticated;
grant insert (pessoa_id, account_id, valor_centavos, data, descricao)
  on table public.reembolsos to authenticated;

create function public.check_reembolso()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  conta_tipo public.tipo_conta;
begin
  select a.tipo into conta_tipo
  from public.accounts a
  where a.id = new.account_id and a.user_id = new.user_id;

  -- O dinheiro entra numa conta de dinheiro (como um pagamento sai de uma). Inexistente: a FK recusa.
  if conta_tipo = 'cartao_credito' then
    raise exception 'Um reembolso entra numa conta de dinheiro, não num cartão'
      using errcode = '23514', hint = 'reembolsos_conta_check';
  end if;

  -- Como os pagamentos (D10a): sem data futura, com 1 dia de tolerância (o servidor usa UTC).
  if new.data > current_date + 1 then
    raise exception 'Um reembolso não pode ter data futura'
      using errcode = '23514', hint = 'reembolsos_futuro_check';
  end if;
  return new;
end;
$$;

create trigger reembolsos_check
  before insert on public.reembolsos
  for each row execute function public.check_reembolso();
