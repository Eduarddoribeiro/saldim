-- Etapa C8 (cartões): estornos e alteração dos dias de fechamento/vencimento.
--
-- Decisões aprovadas:
--   D11  O estorno entra na fatura cujo ciclo contém a data do estorno (como no extrato do banco) e,
--        nos relatórios, abate às despesas da categoria da compra no MÊS DO ESTORNO.
--   D12  Regista-se o valor e a data do extrato; as parcelas já registadas não mudam (D6). Estorno
--        parcial permitido; a soma dos estornos de uma compra nunca passa do valor da compra.
--   D13  Só há estornos em compras no cartão.
--   D14  Mudar os dias de um cartão com faturas: as faturas fechadas ficam como estão; a fatura aberta
--        e as futuras passam aos dias novos; cada parcela fica na fatura do mesmo mês. Recusado se a
--        aberta ou as futuras já tiverem pagamentos.
--
-- Migration incremental: não apaga dados. Os CHECKs substituídos aceitam todas as linhas existentes
-- (as regras antigas são um caso particular das novas).

-- ---------------------------------------------------------------------------------------------------
-- 1. Dias anteriores dos cartões (D14)
--
-- Quando os dias mudam, os dias antigos ficam aqui com o primeiro mês de referência em que JÁ NÃO
-- valem (ate_mes). As faturas de um mês usam a linha com o menor ate_mes > mês; sem linha, os dias
-- atuais do cartão. Assim as faturas fechadas, as compras antigas e as compras registadas mais tarde
-- com datas antigas continuam a dar sempre a mesma fatura. Um cartão que nunca mudou não tem linhas.

create table public.cartao_dias_anteriores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null,
  -- Estes dias valem para as faturas com mes_referencia < ate_mes
  ate_mes date not null,
  dia_fechamento smallint not null,
  dia_vencimento smallint not null,
  created_at timestamptz not null default now(),

  constraint cartao_dias_anteriores_mes_unico unique (account_id, ate_mes),
  constraint cartao_dias_anteriores_mes_check check (extract(day from ate_mes) = 1),
  constraint cartao_dias_anteriores_dias_check check (
    dia_fechamento between 1 and 31 and dia_vencimento between 1 and 31
  ),
  constraint cartao_dias_anteriores_account_fk foreign key (account_id, user_id)
    references public.accounts (id, user_id) on delete cascade
);

comment on table public.cartao_dias_anteriores is
  'Dias de fechamento/vencimento antigos de um cartão: valem para as faturas antes de ate_mes. Só a trigger das contas escreve aqui.';

alter table public.cartao_dias_anteriores enable row level security;

create policy "cartao_dias_anteriores: ler os próprios"
  on public.cartao_dias_anteriores for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "cartao_dias_anteriores: criar para si"
  on public.cartao_dias_anteriores for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- O insert existe só para a trigger das contas (que corre com as permissões de quem escreve);
-- a trigger abaixo recusa inserts diretos. Sem update nem delete (apagar o cartão apaga em cascata).
revoke all on table public.cartao_dias_anteriores from anon, authenticated;
grant select on table public.cartao_dias_anteriores to authenticated;
grant insert (account_id, ate_mes, dia_fechamento, dia_vencimento)
  on table public.cartao_dias_anteriores to authenticated;

create function public.check_cartao_dias_anteriores()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- pg_trigger_depth() = 1: o insert veio diretamente de quem escreve (não da trigger das contas).
  if pg_trigger_depth() = 1 then
    raise exception 'Os dias anteriores de um cartão só se guardam ao mudar os dias do cartão'
      using errcode = '42501', hint = 'cartao_dias_anteriores_direto_check';
  end if;
  return new;
end;
$$;

create trigger cartao_dias_anteriores_check
  before insert on public.cartao_dias_anteriores
  for each row execute function public.check_cartao_dias_anteriores();

-- Datas da fatura do mês p_mes de um cartão, com o histórico: os dias guardados se a fatura é anterior
-- a uma mudança, senão os dias dados (os atuais do cartão, ou os ANTIGOS durante a própria mudança).
create function public.cartao_datas_fatura_hist(
  p_account_id uuid,
  p_mes date,
  p_dia_fechamento integer,
  p_dia_vencimento integer,
  out fechamento date,
  out vencimento date
)
language sql
stable parallel safe
set search_path = ''
as $$
  select d.fechamento, d.vencimento
  from (select 1) as um
  left join lateral (
    select h.dia_fechamento, h.dia_vencimento
    from public.cartao_dias_anteriores h
    where h.account_id = p_account_id and h.ate_mes > p_mes
    order by h.ate_mes
    limit 1
  ) h on true
  cross join lateral public.cartao_datas_fatura(
    coalesce(h.dia_fechamento::integer, p_dia_fechamento),
    coalesce(h.dia_vencimento::integer, p_dia_vencimento),
    p_mes
  ) d
$$;

-- Fatura de uma data (compra ou estorno), com o histórico: a primeira fatura cujo fechamento é depois
-- da data. A resposta está sempre entre o mês da data e dois meses depois (o fechamento da fatura do
-- mês M cai no mês M ou M−1). Os fechamentos crescem de mês para mês, também na transição (garantido
-- ao mudar os dias), por isso a primeira é a do ciclo [fechamento anterior, fechamento) que contém a
-- data. Sem histórico dá exatamente o mesmo que cartao_fatura_da_compra (provado nos testes).
create function public.cartao_fatura_da_data_hist(
  p_account_id uuid,
  p_data date,
  p_dia_fechamento integer,
  p_dia_vencimento integer
)
returns date
language sql
stable parallel safe
set search_path = ''
as $$
  select m.mes
  from generate_series(0, 2) as k
  cross join lateral (
    select (date_trunc('month', p_data::timestamp) + make_interval(months => k))::date as mes
  ) m
  where p_data < (
    public.cartao_datas_fatura_hist(p_account_id, m.mes, p_dia_fechamento, p_dia_vencimento)
  ).fechamento
  order by k
  limit 1
$$;

-- As mesmas duas, com os dias atuais do cartão (RLS: só cartões do próprio utilizador; senão nulo).
create function public.cartao_datas_fatura_conta(
  p_account_id uuid,
  p_mes date,
  out fechamento date,
  out vencimento date
)
language sql
stable parallel safe
set search_path = ''
as $$
  select d.fechamento, d.vencimento
  from public.accounts a
  cross join lateral public.cartao_datas_fatura_hist(a.id, p_mes, a.dia_fechamento, a.dia_vencimento) d
  where a.id = p_account_id and a.tipo = 'cartao_credito'
$$;

create function public.cartao_fatura_da_compra_conta(p_account_id uuid, p_data date)
returns date
language sql
stable parallel safe
set search_path = ''
as $$
  select public.cartao_fatura_da_data_hist(a.id, p_data, a.dia_fechamento, a.dia_vencimento)
  from public.accounts a
  where a.id = p_account_id and a.tipo = 'cartao_credito'
$$;

revoke all on function public.cartao_datas_fatura_hist(uuid, date, integer, integer) from public, anon;
revoke all on function public.cartao_fatura_da_data_hist(uuid, date, integer, integer) from public, anon;
revoke all on function public.cartao_datas_fatura_conta(uuid, date) from public, anon;
revoke all on function public.cartao_fatura_da_compra_conta(uuid, date) from public, anon;
grant execute on function public.cartao_datas_fatura_hist(uuid, date, integer, integer) to authenticated;
grant execute on function public.cartao_fatura_da_data_hist(uuid, date, integer, integer) to authenticated;
grant execute on function public.cartao_datas_fatura_conta(uuid, date) to authenticated;
grant execute on function public.cartao_fatura_da_compra_conta(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 2. Faturas: datas com o histórico; recalculadas (só pela trigger das contas) quando os dias mudam

create or replace function public.set_fatura_datas()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cartao record;
begin
  if tg_op = 'UPDATE' then
    -- Só a trigger das contas recalcula as datas (ao mudar os dias). Diretamente, nada muda.
    if pg_trigger_depth() = 1 then
      raise exception 'As datas de uma fatura são calculadas a partir dos dias do cartão'
        using errcode = '42501', hint = 'faturas_datas_fixas_check';
    end if;
    if (new.account_id, new.user_id, new.mes_referencia)
      is distinct from (old.account_id, old.user_id, old.mes_referencia)
    then
      raise exception 'Uma fatura não muda de cartão nem de mês'
        using errcode = '42501', hint = 'faturas_datas_fixas_check';
    end if;
  end if;

  select a.tipo into cartao
  from public.accounts a
  where a.id = new.account_id and a.user_id = new.user_id;

  -- Conta inexistente/alheia: as datas ficam nulas e a fatura é recusada (sem revelar se a conta existe).
  if not found then
    return new;
  end if;

  if cartao.tipo <> 'cartao_credito' then
    raise exception 'Só os cartões de crédito têm faturas'
      using errcode = '23514', hint = 'faturas_conta_cartao_check';
  end if;

  select d.fechamento, d.vencimento into new.data_fechamento, new.data_vencimento
  from public.cartao_datas_fatura_conta(new.account_id, new.mes_referencia) d;
  return new;
end;
$$;

drop trigger faturas_set_datas on public.faturas;
create trigger faturas_set_datas
  before insert or update on public.faturas
  for each row execute function public.set_fatura_datas();

create policy "faturas: recalcular as próprias"
  on public.faturas for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Só esta coluna, para a trigger das contas poder pedir o recálculo (set data_fechamento = data_fechamento).
grant update (data_fechamento) on table public.faturas to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 3. Estornos (D9a, D11–D13): transações do tipo `estorno` num cartão, ligadas à compra e a uma fatura

-- Categorias são só de receita ou despesa; o estorno usa a categoria (de despesa) da compra.
alter table public.categories
  add constraint categories_tipo_check check (tipo in ('receita', 'despesa'));

alter table public.transactions
  drop constraint transactions_parcela_campos_check,
  drop constraint transactions_parcela_tipo_check,
  -- Três formas, e só estas (as duas primeiras são as regras antigas):
  add constraint transactions_cartao_campos_check check (
    -- normal: receita ou despesa, sem compra
    (fatura_id is null and compra_id is null and parcela_numero is null and tipo <> 'estorno')
    -- parcela de uma compra
    or (fatura_id is not null and compra_id is not null and parcela_numero is not null
      and tipo = 'despesa')
    -- estorno de uma compra: tem fatura, não tem número de parcela
    or (fatura_id is not null and compra_id is not null and parcela_numero is null
      and tipo = 'estorno')
  );

-- O estorno usa uma categoria de DESPESA (a da compra); as outras transações, a do seu tipo.
create or replace function public.check_transaction_category_tipo()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  categoria_tipo public.tipo_movimento;
  esperado public.tipo_movimento;
begin
  select c.tipo into categoria_tipo
  from public.categories c
  where c.id = new.category_id and c.user_id = new.user_id;

  esperado := case when new.tipo = 'estorno' then 'despesa'::public.tipo_movimento else new.tipo end;

  -- Categoria inexistente/alheia: deixa a FK composta recusar com o erro próprio (23503).
  if categoria_tipo is not null and categoria_tipo <> esperado then
    raise exception 'A categoria é de %, mas a transação é de %', categoria_tipo, new.tipo
      using errcode = '23514', constraint = 'transactions_category_tipo_check';
  end if;
  return new;
end;
$$;

-- A compra tem exatamente as suas PARCELAS (os estornos, mais tarde, não contam).
create or replace function public.check_compra_parcelas()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  esperadas integer;
  criadas integer;
begin
  select c.parcelas - c.parcela_inicial + 1 into esperadas
  from public.compras_cartao c
  where c.id = new.id;

  -- Apagada na mesma transação: nada a verificar.
  if not found then
    return null;
  end if;

  select count(*) into criadas
  from public.transactions t
  where t.compra_id = new.id and t.parcela_numero is not null;
  if criadas <> esperadas then
    raise exception 'A compra tem % parcela(s) registada(s), mas devia ter %', criadas, esperadas
      using errcode = '23514', hint = 'compras_cartao_parcelas_check';
  end if;
  return null;
end;
$$;

-- Regras das transações num cartão: parcelas (C3, agora com o histórico de dias) e estornos.
create or replace function public.check_transaction_cartao()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  conta_tipo public.tipo_conta;
  compra public.compras_cartao;
  mes_fatura date;
  ja_estornado bigint;
begin
  -- Parcelas e estornos não se alteram (só a descrição, que não dispara esta trigger).
  if tg_op = 'UPDATE' and old.compra_id is not null and (
    old.account_id, old.category_id, old.tipo, old.valor_centavos, old.data,
    old.fatura_id, old.compra_id, old.parcela_numero
  ) is distinct from (
    new.account_id, new.category_id, new.tipo, new.valor_centavos, new.data,
    new.fatura_id, new.compra_id, new.parcela_numero
  ) then
    raise exception 'As parcelas e os estornos de uma compra no cartão não se alteram: apaga e regista de novo'
      using errcode = '23514', hint = 'transactions_parcela_alterar_check';
  end if;

  select a.tipo into conta_tipo
  from public.accounts a
  where a.id = new.account_id and a.user_id = new.user_id;

  -- Conta normal: sem compra/fatura (as FKs compostas e o CHECK garantem-no). Inexistente/alheia: a FK recusa.
  if conta_tipo is distinct from 'cartao_credito' then
    return new;
  end if;

  if new.compra_id is null then
    raise exception 'Num cartão de crédito só se registam compras (com fatura e parcelas) e estornos'
      using errcode = '23514', hint = 'transactions_conta_cartao_check';
  end if;

  select c.* into compra
  from public.compras_cartao c
  where c.id = new.compra_id and c.account_id = new.account_id and c.user_id = new.user_id;
  select f.mes_referencia into mes_fatura
  from public.faturas f
  where f.id = new.fatura_id and f.account_id = new.account_id and f.user_id = new.user_id;
  -- Compra ou fatura inexistente/alheia/de outro cartão: deixa as FKs compostas recusar.
  if compra.id is null or mes_fatura is null then
    return new;
  end if;

  if new.tipo = 'estorno' then
    if new.category_id <> compra.category_id
      or mes_fatura is distinct from public.cartao_fatura_da_compra_conta(new.account_id, new.data)
    then
      raise exception 'O estorno tem de usar a categoria da compra e a fatura da data do estorno'
        using errcode = '23514', hint = 'transactions_estorno_check';
    end if;
    if new.data < compra.data_compra then
      raise exception 'O estorno não pode ser anterior à compra'
        using errcode = '23514', hint = 'transactions_estorno_data_check';
    end if;
    -- Como nos pagamentos (D10a): sem datas futuras, com 1 dia de tolerância (o servidor usa UTC).
    if new.data > current_date + 1 then
      raise exception 'Um estorno não pode ter data futura'
        using errcode = '23514', hint = 'transactions_estorno_futuro_check';
    end if;
    -- Um estorno de cada vez por compra: dois estornos ao mesmo tempo não passam juntos do total.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.compra_id::text, 0));
    select coalesce(sum(t.valor_centavos), 0) into ja_estornado
    from public.transactions t
    where t.compra_id = new.compra_id and t.tipo = 'estorno' and t.id <> new.id;
    if ja_estornado + new.valor_centavos > compra.valor_total_centavos then
      raise exception 'Os estornos (% centavos) passariam do valor da compra (% centavos)',
        ja_estornado + new.valor_centavos, compra.valor_total_centavos
        using errcode = '23514', hint = 'transactions_estorno_valor_check';
    end if;
    return new;
  end if;

  if new.category_id <> compra.category_id
    or new.parcela_numero not between compra.parcela_inicial and compra.parcelas
    or new.valor_centavos
      <> public.cartao_valor_parcela(compra.valor_total_centavos, compra.parcelas, new.parcela_numero)
    or new.data <> public.cartao_data_parcela(compra.data_compra, new.parcela_numero)
    or mes_fatura is distinct from (
      public.cartao_fatura_da_compra_conta(new.account_id, compra.data_compra)
      + make_interval(months => new.parcela_numero - 1)
    )::date
  then
    raise exception 'A parcela % não corresponde à compra (valor, data, categoria ou fatura)', new.parcela_numero
      using errcode = '23514', hint = 'transactions_parcela_check';
  end if;
  return new;
end;
$$;

-- Uma parcela não se apaga sozinha (apaga-se a compra). Um estorno apaga-se (é a forma de o corrigir),
-- exceto se a sua fatura já tem pagamentos (D6, como as compras).
-- pg_trigger_depth() = 1: o DELETE veio diretamente de quem escreve; em cascata é permitido.
create or replace function public.check_transaction_parcela_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_trigger_depth() = 1 and old.parcela_numero is not null then
    raise exception 'Uma parcela não se apaga sozinha: apaga a compra'
      using errcode = '23514', hint = 'transactions_parcela_apagar_check';
  end if;
  if pg_trigger_depth() = 1 and old.tipo = 'estorno' and exists (
    select 1 from public.transferencias p where p.fatura_id = old.fatura_id
  ) then
    raise exception 'Este estorno está numa fatura com pagamentos e não pode ser apagado'
      using errcode = '23514', hint = 'transactions_estorno_fatura_paga_check';
  end if;
  return old;
end;
$$;

-- Regista um estorno: cria a fatura da data do estorno se faltar e o estorno, numa só transação.
-- security invoker: as regras são as das tabelas (iguais para quem escreve diretamente).
create function public.registar_estorno_cartao(
  p_compra_id uuid,
  p_data date,
  p_valor_centavos bigint,
  p_descricao text default ''
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_compra public.compras_cartao;
  v_mes date;
  v_fatura_id uuid;
  v_estorno_id uuid;
begin
  select c.* into v_compra from public.compras_cartao c where c.id = p_compra_id;
  if not found then
    raise exception 'Compra não encontrada'
      using errcode = '23503', hint = 'transactions_estorno_compra_check';
  end if;

  v_mes := public.cartao_fatura_da_compra_conta(v_compra.account_id, p_data);
  if v_mes is not null then
    insert into public.faturas (account_id, mes_referencia)
    values (v_compra.account_id, v_mes)
    on conflict (account_id, mes_referencia) do nothing;

    select f.id into v_fatura_id
    from public.faturas f
    where f.account_id = v_compra.account_id and f.mes_referencia = v_mes;
  end if;

  -- Data nula ou fatura em falta: o CHECK e as triggers recusam com a mensagem própria.
  insert into public.transactions (
    account_id, category_id, tipo, valor_centavos, data, descricao, fatura_id, compra_id
  ) values (
    v_compra.account_id, v_compra.category_id, 'estorno', p_valor_centavos, p_data,
    coalesce(p_descricao, ''), v_fatura_id, v_compra.id
  )
  returning id into v_estorno_id;

  return v_estorno_id;
end;
$$;

revoke all on function public.registar_estorno_cartao(uuid, date, bigint, text) from public, anon;
grant execute on function public.registar_estorno_cartao(uuid, date, bigint, text) to authenticated;

-- As compras novas também usam o histórico de dias (antes: só os dias atuais).
create or replace function public.registar_compra_cartao(
  p_account_id uuid,
  p_category_id uuid,
  p_data_compra date,
  p_valor_total_centavos bigint,
  p_parcelas integer,
  p_parcela_inicial integer default 1,
  p_descricao text default ''
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
  -- As regras da compra (cartão do utilizador, categoria de despesa, valor, parcelas, datas) são
  -- verificadas pelas constraints e triggers da tabela, iguais para quem escreve diretamente.
  insert into public.compras_cartao (
    account_id, category_id, descricao, data_compra, valor_total_centavos, parcelas, parcela_inicial
  ) values (
    p_account_id, p_category_id, coalesce(p_descricao, ''), p_data_compra, p_valor_total_centavos,
    p_parcelas, coalesce(p_parcela_inicial, 1)
  )
  returning id into v_compra_id;

  -- A compra foi aceite: a conta existe, é do utilizador e é um cartão.
  v_primeira_fatura := public.cartao_fatura_da_compra_conta(p_account_id, p_data_compra);

  for numero in coalesce(p_parcela_inicial, 1) .. p_parcelas loop
    v_mes := (v_primeira_fatura + make_interval(months => numero - 1))::date;

    -- A fatura pode já existir (outra compra); se não, é criada com as datas calculadas pela trigger.
    insert into public.faturas (account_id, mes_referencia)
    values (p_account_id, v_mes)
    on conflict (account_id, mes_referencia) do nothing;

    select f.id into strict v_fatura_id
    from public.faturas f
    where f.account_id = p_account_id and f.mes_referencia = v_mes;

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

-- ---------------------------------------------------------------------------------------------------
-- 4. Contas: mudar os dias de um cartão com faturas (D14). Substitui o bloqueio "até à C8".

create or replace function public.check_account_cartao()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_mes date;
begin
  -- Um cartão paga-se com uma conta de dinheiro, não com outro cartão.
  if new.tipo = 'cartao_credito' and exists (
    select 1 from public.accounts a
    where a.id = new.conta_pagamento_id and a.user_id = new.user_id and a.tipo = 'cartao_credito'
  ) then
    raise exception 'A conta de pagamento de um cartão não pode ser outro cartão'
      using errcode = '23514', hint = 'accounts_conta_pagamento_tipo_check';
  end if;

  if tg_op = 'UPDATE' and old.tipo is distinct from new.tipo then
    -- Uma conta que paga um cartão não pode passar a ser um cartão.
    if new.tipo = 'cartao_credito' and exists (
      select 1 from public.accounts a where a.conta_pagamento_id = new.id
    ) then
      raise exception 'Esta conta paga um cartão e não pode passar a ser um cartão'
        using errcode = '23514', hint = 'accounts_conta_pagamento_tipo_check';
    end if;

    -- Movimentos de uma conta de dinheiro e de um cartão têm regras diferentes: com movimentos
    -- (transações, compras, faturas ou transferências), a conta não muda de/para cartão.
    if (old.tipo = 'cartao_credito' or new.tipo = 'cartao_credito') and (
      exists (select 1 from public.transactions t where t.account_id = new.id)
      or exists (select 1 from public.compras_cartao c where c.account_id = new.id)
      or exists (select 1 from public.faturas f where f.account_id = new.id)
      or exists (
        select 1 from public.transferencias p
        where p.conta_origem_id = new.id or p.conta_destino_id = new.id
      )
    ) then
      raise exception 'Uma conta com transações não pode mudar de ou para cartão de crédito'
        using errcode = '23514', hint = 'accounts_tipo_cartao_em_uso_check';
    end if;
  end if;

  -- D14: dias novos num cartão com faturas. A primeira fatura com os dias novos é a que está aberta
  -- hoje (calculada com os dias ANTIGOS, a linha ainda não mudou). Os dias novos são aplicados pela
  -- trigger AFTER (accounts_aplicar_dias_cartao), que também confirma as compras já registadas.
  if tg_op = 'UPDATE' and old.tipo = 'cartao_credito' and new.tipo = 'cartao_credito'
    and (old.dia_fechamento, old.dia_vencimento) is distinct from (new.dia_fechamento, new.dia_vencimento)
    and exists (select 1 from public.faturas f where f.account_id = new.id)
  then
    v_mes := public.cartao_fatura_da_data_hist(new.id, current_date, old.dia_fechamento, old.dia_vencimento);

    -- A fatura aberta continua aberta: com os dias novos tem de fechar depois de hoje. Garante também
    -- que os fechamentos continuam a crescer (o da fatura anterior, fechada, é ≤ hoje).
    if (public.cartao_datas_fatura(new.dia_fechamento, new.dia_vencimento, v_mes)).fechamento <= current_date then
      raise exception 'Com estes dias, a fatura aberta (%) fecharia hoje ou antes', to_char(v_mes, 'YYYY-MM')
        using errcode = '23514', hint = 'accounts_cartao_dias_transicao_check';
    end if;

    if exists (
      select 1
      from public.faturas f
      join public.transferencias p on p.fatura_id = f.id
      where f.account_id = new.id and f.mes_referencia >= v_mes
    ) then
      raise exception 'A fatura aberta ou uma fatura futura deste cartão já tem pagamentos'
        using errcode = '23514', hint = 'accounts_cartao_dias_pagamentos_check';
    end if;
  end if;

  return new;
end;
$$;

create function public.aplicar_dias_cartao()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_mes date;
begin
  if not exists (select 1 from public.faturas f where f.account_id = new.id) then
    return null;
  end if;

  -- O mesmo mês que a trigger BEFORE validou (dias antigos, histórico ainda sem a linha nova).
  v_mes := public.cartao_fatura_da_data_hist(new.id, current_date, old.dia_fechamento, old.dia_vencimento);

  -- Os dias antigos valem para as faturas antes de v_mes. Se já há uma linha até v_mes (os dias
  -- mudaram duas vezes no mesmo ciclo), os dias intermédios nunca valeram para nenhuma fatura fechada.
  if not exists (
    select 1 from public.cartao_dias_anteriores h
    where h.account_id = new.id and h.ate_mes >= v_mes
  ) then
    insert into public.cartao_dias_anteriores (account_id, ate_mes, dia_fechamento, dia_vencimento)
    values (new.id, v_mes, old.dia_fechamento, old.dia_vencimento);
  end if;

  -- Recalcula as datas da fatura aberta e das futuras (a trigger das faturas calcula-as).
  update public.faturas f
  set data_fechamento = f.data_fechamento
  where f.account_id = new.id and f.mes_referencia >= v_mes;

  -- Cada parcela e cada estorno continua na fatura que a compra (ou a data do estorno) determina.
  -- Só pode falhar com compras ou estornos com data futura; nesse caso nada muda.
  if exists (
    select 1
    from public.transactions t
    join public.compras_cartao c on c.id = t.compra_id
    join public.faturas f on f.id = t.fatura_id
    where t.account_id = new.id and f.mes_referencia >= v_mes and (
      (t.parcela_numero is not null and f.mes_referencia is distinct from (
        public.cartao_fatura_da_compra_conta(new.id, c.data_compra)
        + make_interval(months => t.parcela_numero - 1)
      )::date)
      or (t.tipo = 'estorno'
        and f.mes_referencia is distinct from public.cartao_fatura_da_compra_conta(new.id, t.data))
    )
  ) then
    raise exception 'Com estes dias, compras ou estornos já registados mudariam de fatura'
      using errcode = '23514', hint = 'accounts_cartao_dias_compras_check';
  end if;

  return null;
end;
$$;

create trigger accounts_aplicar_dias_cartao
  after update of dia_fechamento, dia_vencimento on public.accounts
  for each row
  when (
    old.tipo = 'cartao_credito' and new.tipo = 'cartao_credito'
    and (old.dia_fechamento, old.dia_vencimento) is distinct from (new.dia_fechamento, new.dia_vencimento)
  )
  execute function public.aplicar_dias_cartao();
