-- Etapa C3 (cartões): faturas, compras parceladas e a função atómica registar_compra_cartao.
-- Regras em docs/plano.md → "Cartões de crédito"; os mesmos cálculos em src/lib/credit-card.ts
-- (comparados com estes nos testes de tests/rls/cards-purchases.test.ts).
-- Só acrescenta: tabelas novas, colunas nulas em transactions e regras. Não altera dados existentes.
--
-- Garantias (valem para QUALQUER escrita, não só para a função — a função é security invoker, por isso
-- o utilizador tem os mesmos privilégios quando escreve diretamente nas tabelas):
-- - uma fatura só existe para um cartão e as suas datas são calculadas aqui, nunca enviadas pelo cliente;
-- - uma transação num cartão é sempre uma parcela de uma compra, na fatura certa, com o valor e a data certos;
-- - uma compra tem exatamente as suas parcelas (verificado no fim da transação);
-- - parcelas e compras não se alteram; uma parcela não se apaga sozinha (apaga-se a compra).

-- ---------------------------------------------------------------------------------------------------
-- 1. Cálculos (iguais a src/lib/credit-card.ts)

-- Dia `dia` do mês que começa em `mes`, ou o último dia se o mês for mais curto (31 em abril → 30).
create function public.cartao_dia_no_mes(mes date, dia integer)
returns date
language sql
immutable strict parallel safe
set search_path = ''
as $$
  select mes + (least(dia, extract(day from (mes + interval '1 month' - interval '1 day'))::integer) - 1)
$$;

-- Datas da fatura que vence no mês `mes_referencia` (1.º dia do mês) — igual a invoiceDates:
-- vencimento = dia V desse mês; fechamento = dia F no mesmo mês se V > F, ou no mês anterior se V < F.
create function public.cartao_datas_fatura(
  dia_fechamento integer,
  dia_vencimento integer,
  mes_referencia date,
  out fechamento date,
  out vencimento date
)
language sql
immutable strict parallel safe
set search_path = ''
as $$
  select
    public.cartao_dia_no_mes(
      case
        when dia_vencimento > dia_fechamento then mes_referencia
        else (mes_referencia - interval '1 month')::date
      end,
      dia_fechamento
    ),
    public.cartao_dia_no_mes(mes_referencia, dia_vencimento)
$$;

-- Fatura (1.º dia do mês de referência) de uma compra — igual a invoiceForPurchase:
-- a fatura cujo ciclo [fechamento anterior, fechamento) contém a data; no dia do fechamento → a seguinte.
create function public.cartao_fatura_da_compra(
  dia_fechamento integer,
  dia_vencimento integer,
  data_compra date
)
returns date
language sql
immutable strict parallel safe
set search_path = ''
as $$
  with candidata as (
    select (date_trunc('month', data_compra::timestamp)
      + case when dia_vencimento > dia_fechamento then interval '0' else interval '1 month' end
    )::date as mes
  )
  select case
    when data_compra < (public.cartao_datas_fatura(dia_fechamento, dia_vencimento, mes)).fechamento
      then mes
    else (mes + interval '1 month')::date
  end
  from candidata
$$;

-- Valor da parcela `numero` de `parcelas` — igual a splitInstallments: todas valem floor(total / n)
-- e a ÚLTIMA leva também o resto (D3c). A soma é exatamente o total.
create function public.cartao_valor_parcela(total bigint, parcelas integer, numero integer)
returns bigint
language sql
immutable strict parallel safe
set search_path = ''
as $$
  select total / parcelas + case when numero = parcelas then total % parcelas else 0 end
$$;

-- Data da parcela `numero` — igual a installmentSchedule: data da compra + (numero − 1) meses
-- (o Postgres ajusta ao último dia do mês: 31/01 + 1 mês = 28/02 ou 29/02).
create function public.cartao_data_parcela(data_compra date, numero integer)
returns date
language sql
immutable strict parallel safe
set search_path = ''
as $$
  select (data_compra + make_interval(months => numero - 1))::date
$$;

-- ---------------------------------------------------------------------------------------------------
-- 2. Faturas

create table public.faturas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- O cartão (FK composta: do mesmo utilizador)
  account_id uuid not null,
  -- Mês do vencimento (1.º dia do mês): identifica a fatura
  mes_referencia date not null,
  -- Calculadas pela trigger ao criar a fatura e depois fixas (a configuração pode mudar na C8)
  data_fechamento date not null,
  data_vencimento date not null,
  created_at timestamptz not null default now(),

  constraint faturas_mes_unico unique (account_id, mes_referencia),
  -- Alvo da FK composta das transações (a parcela e a fatura são do mesmo cartão e do mesmo utilizador)
  constraint faturas_id_conta_user_key unique (id, account_id, user_id),
  constraint faturas_mes_check check (
    extract(day from mes_referencia) = 1
    and mes_referencia between date '1900-01-01' and date '2999-12-01'
  ),
  -- Só datas que a base de dados aceita (risco R1 da C1) e coerentes com o mês de referência
  constraint faturas_datas_check check (
    data_fechamento >= date '1900-01-01'
    and data_fechamento < data_vencimento
    and data_vencimento >= mes_referencia
    and data_vencimento < (mes_referencia + interval '1 month')
  ),
  -- CASCADE: um cartão só se apaga sem parcelas (a FK das transações recusa antes); as faturas vazias vão com ele
  constraint faturas_account_fk foreign key (account_id, user_id)
    references public.accounts (id, user_id) on delete cascade
);

comment on table public.faturas is
  'Faturas dos cartões; uma por cartão e mês de vencimento. O estado é calculado, nunca guardado.';

create index faturas_user_idx on public.faturas (user_id, mes_referencia);

alter table public.faturas enable row level security;

create policy "faturas: ler as próprias"
  on public.faturas for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "faturas: criar para si"
  on public.faturas for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Sem update nem delete: as datas são fixas e uma fatura vazia não faz mal (o estado é "sem compras").
-- No insert só o cartão e o mês: as datas são sempre calculadas aqui.
revoke all on table public.faturas from anon, authenticated;
grant select on table public.faturas to authenticated;
grant insert (account_id, mes_referencia) on table public.faturas to authenticated;

-- security invoker (o padrão): corre com as permissões de quem escreve, por isso a RLS aplica-se.
-- O nome da regra vai no HINT para a interface escolher a mensagem.
create function public.set_fatura_datas()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cartao record;
begin
  select a.tipo, a.dia_fechamento, a.dia_vencimento into cartao
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
  from public.cartao_datas_fatura(cartao.dia_fechamento, cartao.dia_vencimento, new.mes_referencia) d;
  return new;
end;
$$;

create trigger faturas_set_datas
  before insert on public.faturas
  for each row execute function public.set_fatura_datas();

-- ---------------------------------------------------------------------------------------------------
-- 3. Compras no cartão

create table public.compras_cartao (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null,
  category_id uuid not null,
  descricao text not null default ''
    check (char_length(descricao) <= 120 and descricao = trim(descricao)),
  -- Data ORIGINAL da compra (também numa compra já em curso, D5a)
  data_compra date not null check (data_compra between date '1900-01-01' and date '2999-12-31'),
  -- Valor ORIGINAL da compra; cada parcela tem pelo menos 1 centavo. MAX_CENTS de src/lib/money.ts
  valor_total_centavos bigint not null,
  -- MAX_PARCELAS de src/lib/credit-card.ts
  parcelas smallint not null,
  -- Primeira parcela registada: 1 = compra nova; k > 1 = compra em curso (as anteriores já foram pagas)
  parcela_inicial smallint not null default 1,
  created_at timestamptz not null default now(),

  constraint compras_cartao_parcelas_check check (
    parcelas between 1 and 48 and parcela_inicial between 1 and parcelas
  ),
  constraint compras_cartao_valor_check check (
    valor_total_centavos between parcelas and 99999999999
  ),
  -- Alvo da FK composta das parcelas (a parcela é do mesmo cartão e do mesmo utilizador da compra)
  constraint compras_cartao_id_conta_user_key unique (id, account_id, user_id),
  constraint compras_cartao_account_fk foreign key (account_id, user_id)
    references public.accounts (id, user_id) on delete no action,
  constraint compras_cartao_category_fk foreign key (category_id, user_id)
    references public.categories (id, user_id) on delete no action
);

comment on table public.compras_cartao is
  'Compras no cartão (valor e parcelas originais); as parcelas são transações ligadas a uma fatura.';

create index compras_cartao_user_idx on public.compras_cartao (user_id, data_compra desc);
create index compras_cartao_account_idx on public.compras_cartao (account_id);
create index compras_cartao_category_idx on public.compras_cartao (category_id);

alter table public.compras_cartao enable row level security;

create policy "compras_cartao: ler as próprias"
  on public.compras_cartao for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "compras_cartao: criar para si"
  on public.compras_cartao for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "compras_cartao: apagar as próprias"
  on public.compras_cartao for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Sem update: na v1, alterar uma compra = apagá-la (as parcelas vão com ela) e registá-la de novo.
revoke all on table public.compras_cartao from anon, authenticated;
grant select, delete on table public.compras_cartao to authenticated;
grant insert (
  account_id, category_id, descricao, data_compra, valor_total_centavos, parcelas, parcela_inicial
) on table public.compras_cartao to authenticated;

-- A conta tem de ser um cartão e a categoria de despesa.
create function public.check_compra_cartao()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  conta_tipo public.tipo_conta;
  categoria_tipo public.tipo_movimento;
begin
  select a.tipo into conta_tipo
  from public.accounts a
  where a.id = new.account_id and a.user_id = new.user_id;

  -- Conta inexistente/alheia: deixa a FK composta recusar com o erro próprio (23503).
  if conta_tipo is not null and conta_tipo <> 'cartao_credito' then
    raise exception 'Uma compra no cartão tem de usar uma conta do tipo cartão de crédito'
      using errcode = '23514', hint = 'compras_cartao_conta_check';
  end if;

  select c.tipo into categoria_tipo
  from public.categories c
  where c.id = new.category_id and c.user_id = new.user_id;

  if categoria_tipo is not null and categoria_tipo <> 'despesa' then
    raise exception 'Uma compra no cartão tem de usar uma categoria de despesa'
      using errcode = '23514', hint = 'compras_cartao_categoria_check';
  end if;
  return new;
end;
$$;

create trigger compras_cartao_check
  before insert on public.compras_cartao
  for each row execute function public.check_compra_cartao();

-- No FIM da transação (deferred): a compra tem exatamente as suas parcelas. Junto com as regras das
-- parcelas (abaixo) e o unique (compra_id, parcela_numero), o conjunto de parcelas fica exato.
create function public.check_compra_parcelas()
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

  select count(*) into criadas from public.transactions t where t.compra_id = new.id;
  if criadas <> esperadas then
    raise exception 'A compra tem % parcela(s) registada(s), mas devia ter %', criadas, esperadas
      using errcode = '23514', hint = 'compras_cartao_parcelas_check';
  end if;
  return null;
end;
$$;

create constraint trigger compras_cartao_check_parcelas
  after insert on public.compras_cartao
  deferrable initially deferred
  for each row execute function public.check_compra_parcelas();

-- ---------------------------------------------------------------------------------------------------
-- 4. Parcelas = transações de despesa num cartão, ligadas à compra e à fatura

alter table public.transactions
  add column fatura_id uuid,
  add column compra_id uuid,
  add column parcela_numero smallint;

alter table public.transactions
  -- Os três juntos: ou é uma parcela (todos preenchidos) ou uma transação normal (todos nulos)
  add constraint transactions_parcela_campos_check check (
    (fatura_id is null) = (compra_id is null) and (compra_id is null) = (parcela_numero is null)
  ),
  add constraint transactions_parcela_tipo_check check (compra_id is null or tipo = 'despesa'),
  add constraint transactions_parcela_unica unique (compra_id, parcela_numero),
  -- FKs COMPOSTAS com account_id e user_id: a fatura e a compra são do MESMO cartão e utilizador.
  -- Como as faturas e as compras só existem em cartões, uma transação normal nunca tem fatura.
  add constraint transactions_fatura_fk foreign key (fatura_id, account_id, user_id)
    references public.faturas (id, account_id, user_id) on delete no action,
  -- CASCADE: apagar a compra apaga as suas parcelas
  add constraint transactions_compra_fk foreign key (compra_id, account_id, user_id)
    references public.compras_cartao (id, account_id, user_id) on delete cascade;

create index transactions_fatura_idx on public.transactions (fatura_id) where fatura_id is not null;

-- As colunas novas NÃO entram no grant update de transactions: uma parcela não muda de fatura nem de compra.

-- Substitui a regra temporária da C2 (transactions_check_account_not_card) pela definitiva.
drop trigger transactions_check_account_not_card on public.transactions;
drop function public.check_transaction_account_not_card();

create function public.check_transaction_cartao()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  conta_tipo public.tipo_conta;
  compra public.compras_cartao;
  cartao record;
  mes_fatura date;
begin
  -- Parcelas não se alteram (só a descrição, que não dispara esta trigger).
  if tg_op = 'UPDATE' and old.compra_id is not null and (
    old.account_id, old.category_id, old.tipo, old.valor_centavos, old.data,
    old.fatura_id, old.compra_id, old.parcela_numero
  ) is distinct from (
    new.account_id, new.category_id, new.tipo, new.valor_centavos, new.data,
    new.fatura_id, new.compra_id, new.parcela_numero
  ) then
    raise exception 'As parcelas de uma compra no cartão não se alteram: apaga a compra e regista-a de novo'
      using errcode = '23514', hint = 'transactions_parcela_alterar_check';
  end if;

  select a.tipo into conta_tipo
  from public.accounts a
  where a.id = new.account_id and a.user_id = new.user_id;

  -- Conta normal: sem compra/fatura (as FKs compostas garantem-no). Inexistente/alheia: a FK recusa.
  if conta_tipo is distinct from 'cartao_credito' then
    return new;
  end if;

  if new.compra_id is null then
    raise exception 'Num cartão de crédito só se registam compras (com fatura e parcelas)'
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

  select a.dia_fechamento, a.dia_vencimento into cartao
  from public.accounts a
  where a.id = new.account_id;

  if new.category_id <> compra.category_id
    or new.parcela_numero not between compra.parcela_inicial and compra.parcelas
    or new.valor_centavos
      <> public.cartao_valor_parcela(compra.valor_total_centavos, compra.parcelas, new.parcela_numero)
    or new.data <> public.cartao_data_parcela(compra.data_compra, new.parcela_numero)
    or mes_fatura <> (
      public.cartao_fatura_da_compra(cartao.dia_fechamento, cartao.dia_vencimento, compra.data_compra)
      + make_interval(months => new.parcela_numero - 1)
    )::date
  then
    raise exception 'A parcela % não corresponde à compra (valor, data, categoria ou fatura)', new.parcela_numero
      using errcode = '23514', hint = 'transactions_parcela_check';
  end if;
  return new;
end;
$$;

create trigger transactions_check_cartao
  before insert or update of account_id, category_id, tipo, valor_centavos, data,
    fatura_id, compra_id, parcela_numero
  on public.transactions
  for each row execute function public.check_transaction_cartao();

-- Uma parcela não se apaga sozinha: apaga-se a compra (as parcelas vão em cascata).
-- pg_trigger_depth() = 1: o DELETE veio diretamente de quem escreve. Em cascata (apagar a compra ou o
-- utilizador) o DELETE corre dentro da trigger da FK, com profundidade > 1, e é permitido.
create function public.check_transaction_parcela_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.compra_id is not null and pg_trigger_depth() = 1 then
    raise exception 'Uma parcela não se apaga sozinha: apaga a compra'
      using errcode = '23514', hint = 'transactions_parcela_apagar_check';
  end if;
  return old;
end;
$$;

create trigger transactions_check_parcela_delete
  before delete on public.transactions
  for each row execute function public.check_transaction_parcela_delete();

-- ---------------------------------------------------------------------------------------------------
-- 5. Contas: regras da C2 + cartões com faturas

create or replace function public.check_account_cartao()
returns trigger
language plpgsql
set search_path = ''
as $$
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
    -- (transações, compras ou faturas), a conta não muda de/para cartão.
    if (old.tipo = 'cartao_credito' or new.tipo = 'cartao_credito') and (
      exists (select 1 from public.transactions t where t.account_id = new.id)
      or exists (select 1 from public.compras_cartao c where c.account_id = new.id)
      or exists (select 1 from public.faturas f where f.account_id = new.id)
    ) then
      raise exception 'Uma conta com transações não pode mudar de ou para cartão de crédito'
        using errcode = '23514', hint = 'accounts_tipo_cartao_em_uso_check';
    end if;
  end if;

  -- ATÉ À C8: mudar os dias de um cartão com faturas mudaria a fatura das compras já registadas.
  -- O limite e a conta de pagamento continuam editáveis.
  if tg_op = 'UPDATE' and old.tipo = 'cartao_credito' and new.tipo = 'cartao_credito'
    and (old.dia_fechamento, old.dia_vencimento) is distinct from (new.dia_fechamento, new.dia_vencimento)
    and exists (select 1 from public.faturas f where f.account_id = new.id)
  then
    raise exception 'Os dias de fechamento e vencimento de um cartão com faturas ainda não podem ser alterados'
      using errcode = '23514', hint = 'accounts_cartao_dias_em_uso_check';
  end if;

  return new;
end;
$$;

drop trigger accounts_check_cartao on public.accounts;
create trigger accounts_check_cartao
  before insert or update of tipo, conta_pagamento_id, dia_fechamento, dia_vencimento
  on public.accounts
  for each row execute function public.check_account_cartao();

-- ---------------------------------------------------------------------------------------------------
-- 6. Função atómica: compra + faturas em falta + parcelas, numa só transação

-- security invoker: corre com as permissões e a RLS de quem a chama (nunca com privilégios elevados).
-- Atómica: a chamada RPC é uma única transação; qualquer erro (de uma regra, de uma FK ou da
-- verificação final das parcelas) desfaz a compra, as faturas criadas e as parcelas já inseridas.
create function public.registar_compra_cartao(
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
  v_cartao record;
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
  select a.dia_fechamento, a.dia_vencimento into strict v_cartao
  from public.accounts a
  where a.id = p_account_id;

  v_primeira_fatura :=
    public.cartao_fatura_da_compra(v_cartao.dia_fechamento, v_cartao.dia_vencimento, p_data_compra);

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

-- Só utilizadores autenticados; anon não executa nenhuma das funções novas.
revoke all on function public.registar_compra_cartao(uuid, uuid, date, bigint, integer, integer, text)
  from public, anon;
grant execute on function public.registar_compra_cartao(uuid, uuid, date, bigint, integer, integer, text)
  to authenticated;

revoke all on function public.cartao_dia_no_mes(date, integer) from public, anon;
revoke all on function public.cartao_datas_fatura(integer, integer, date) from public, anon;
revoke all on function public.cartao_fatura_da_compra(integer, integer, date) from public, anon;
revoke all on function public.cartao_valor_parcela(bigint, integer, integer) from public, anon;
revoke all on function public.cartao_data_parcela(date, integer) from public, anon;
grant execute on function public.cartao_dia_no_mes(date, integer) to authenticated;
grant execute on function public.cartao_datas_fatura(integer, integer, date) to authenticated;
grant execute on function public.cartao_fatura_da_compra(integer, integer, date) to authenticated;
grant execute on function public.cartao_valor_parcela(bigint, integer, integer) to authenticated;
grant execute on function public.cartao_data_parcela(date, integer) to authenticated;
