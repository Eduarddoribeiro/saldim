-- Etapa R1: lançamentos recorrentes (D15–D18 em docs/plano.md).
--
-- Uma recorrência descreve um lançamento que se repete (ex.: Netflix todo dia 10 no cartão, salário
-- todo dia 5 no PicPay). Os lançamentos são criados pela função gerar_recorrencias, que a app chama ao
-- abrir: cria os que já chegaram ao dia (também os que faltaram se a app ficou dias fechada) e avança
-- a próxima data. Os futuros não existem até chegar o dia, por isso não mexem no saldo nem no limite.
-- Migration incremental: tabela nova + uma coluna opcional nas transações; nada é apagado.

-- ---------------------------------------------------------------------------------------------------
-- 1. Tabela das recorrências

create table public.recorrencias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null,
  category_id uuid not null,
  tipo public.tipo_movimento not null,
  -- MAX_CENTS de src/lib/money.ts
  valor_centavos bigint not null,
  -- O nome do lançamento (ex.: "Netflix"): obrigatório, é o que identifica a recorrência
  descricao text not null,
  frequencia text not null,
  -- Dia pedido (1–31). Num mês sem esse dia, usa-se o último (31 → 28/02 → 31/03): por isso fica
  -- guardado à parte da próxima data.
  dia smallint not null,
  -- Data do próximo lançamento por criar
  proxima_data date not null,
  ativa boolean not null default true,
  -- Último lançamento que não foi possível criar (regra que o recusou e a data); a app mostra-o até a
  -- pessoa o dispensar
  falha text,
  falha_data date,
  created_at timestamptz not null default now(),

  -- D17: receitas e despesas (estornos só existem ligados a uma compra)
  constraint recorrencias_tipo_check check (tipo in ('receita', 'despesa')),
  constraint recorrencias_valor_check check (valor_centavos between 1 and 99999999999),
  constraint recorrencias_descricao_check check (
    char_length(descricao) between 1 and 120 and descricao = trim(descricao)
  ),
  -- D16: mensal ou anual
  constraint recorrencias_frequencia_check check (frequencia in ('mensal', 'anual')),
  -- A próxima data cai no dia pedido, ou no último dia de um mês que não o tem
  constraint recorrencias_dia_check check (
    dia between 1 and 31
    and (
      extract(day from proxima_data) = dia
      or (
        extract(day from proxima_data) < dia
        and proxima_data = (date_trunc('month', proxima_data) + interval '1 month - 1 day')::date
      )
    )
  ),
  constraint recorrencias_proxima_data_check check (
    proxima_data between date '1900-01-01' and date '2999-12-31'
  ),
  constraint recorrencias_falha_check check (
    (falha is null) = (falha_data is null) and char_length(falha) <= 100
  ),
  -- Alvo da FK composta das transações (a transação é do mesmo utilizador da recorrência)
  constraint recorrencias_id_user_key unique (id, user_id),
  -- FKs compostas: a conta e a categoria são do mesmo utilizador. NO ACTION: uma conta ou categoria
  -- usada numa recorrência não se apaga (a app explica porquê); apagar o utilizador continua a funcionar.
  constraint recorrencias_account_fk foreign key (account_id, user_id)
    references public.accounts (id, user_id) on delete no action,
  constraint recorrencias_category_fk foreign key (category_id, user_id)
    references public.categories (id, user_id) on delete no action
);

comment on table public.recorrencias is
  'Lançamentos que se repetem (mensal/anual); gerar_recorrencias cria cada um quando chega o dia.';

create index recorrencias_user_proxima_idx on public.recorrencias (user_id, proxima_data) where ativa;
create index recorrencias_account_idx on public.recorrencias (account_id);
create index recorrencias_category_idx on public.recorrencias (category_id);

alter table public.recorrencias enable row level security;

create policy "recorrencias: ler as próprias"
  on public.recorrencias for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "recorrencias: criar para si"
  on public.recorrencias for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "recorrencias: alterar as próprias"
  on public.recorrencias for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "recorrencias: apagar as próprias"
  on public.recorrencias for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.recorrencias from anon, authenticated;
grant select, delete on table public.recorrencias to authenticated;
grant insert (
  account_id, category_id, tipo, valor_centavos, descricao, frequencia, dia, proxima_data, ativa
) on table public.recorrencias to authenticated;
-- falha/falha_data: a pessoa só as limpa (dispensar o aviso); quem as escreve é gerar_recorrencias
grant update (
  account_id, category_id, tipo, valor_centavos, descricao, frequencia, dia, proxima_data, ativa,
  falha, falha_data
) on table public.recorrencias to authenticated;

-- Regras que dependem de outras tabelas ou da data de hoje.
create function public.check_recorrencia()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  conta_tipo public.tipo_conta;
  categoria_tipo public.tipo_movimento;
begin
  select c.tipo into categoria_tipo
  from public.categories c
  where c.id = new.category_id and c.user_id = new.user_id;

  -- Categoria inexistente/alheia: deixa a FK composta recusar com o erro próprio (23503).
  if categoria_tipo is not null and categoria_tipo <> new.tipo then
    raise exception 'A categoria é de %, mas o lançamento é de %', categoria_tipo, new.tipo
      using errcode = '23514', hint = 'recorrencias_categoria_check';
  end if;

  select a.tipo into conta_tipo
  from public.accounts a
  where a.id = new.account_id and a.user_id = new.user_id;

  -- Num cartão só há compras (despesas)
  if conta_tipo = 'cartao_credito' and new.tipo <> 'despesa' then
    raise exception 'Num cartão de crédito só há despesas'
      using errcode = '23514', hint = 'recorrencias_cartao_check';
  end if;

  -- D18: nunca se criam lançamentos com data passada. A próxima data escolhida (ao criar, ao mudar
  -- ou ao retomar) não pode ser anterior a hoje, com 1 dia de tolerância (o servidor usa UTC).
  if (tg_op = 'INSERT' or new.proxima_data is distinct from old.proxima_data)
    and new.proxima_data < current_date - 1
  then
    raise exception 'A próxima data (%) já passou', new.proxima_data
      using errcode = '23514', hint = 'recorrencias_data_check';
  end if;
  return new;
end;
$$;

create trigger recorrencias_check
  before insert or update on public.recorrencias
  for each row execute function public.check_recorrencia();

-- ---------------------------------------------------------------------------------------------------
-- 2. Transações criadas por uma recorrência

-- Liga o lançamento à recorrência que o criou (a app mostra "Recorrente"). Apagar a recorrência não
-- apaga os lançamentos já criados: a ligação fica a null (só essa coluna; o user_id mantém-se).
alter table public.transactions
  add column recorrencia_id uuid,
  add constraint transactions_recorrencia_fk foreign key (recorrencia_id, user_id)
    references public.recorrencias (id, user_id) on delete set null (recorrencia_id);

create index transactions_recorrencia_idx on public.transactions (recorrencia_id)
  where recorrencia_id is not null;

-- Numa compra no cartão a transação é criada por registar_compra_cartao; gerar_recorrencias liga-a
-- depois. A trigger das parcelas não olha para esta coluna, por isso ligá-la não altera a parcela.
grant update (recorrencia_id) on table public.transactions to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- 3. Datas e geração

-- Próxima data depois de p_data: o mês seguinte (ou o mesmo mês no ano seguinte), no dia p_dia ou no
-- último dia do mês se for mais curto. Espelho em TS: nextOccurrence (src/lib/recurrence.ts).
create function public.recorrencia_seguinte(p_data date, p_frequencia text, p_dia integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select (
    s.mes + (least(p_dia, extract(day from (s.mes + interval '1 month - 1 day'))::integer) - 1)
  )::date
  from (
    select (
      date_trunc('month', p_data)
      + case when p_frequencia = 'anual' then interval '12 months' else interval '1 month' end
    )::date as mes
  ) s
$$;

revoke all on function public.recorrencia_seguinte(date, text, integer) from public, anon;
grant execute on function public.recorrencia_seguinte(date, text, integer) to authenticated;

-- D15: cria os lançamentos das recorrências ativas cuja data já chegou (até p_hoje, a data local da
-- app, com 1 dia de tolerância face ao servidor) e avança a próxima data. Devolve quantos criou.
-- security invoker: corre como quem chama, por isso a RLS e todas as regras das transações e das
-- compras no cartão aplicam-se como numa escrita normal.
-- Duas chamadas ao mesmo tempo (dois separadores): o FOR UPDATE faz a segunda esperar e, depois, a
-- recorrência já tem a próxima data no futuro e é ignorada — nada fica duplicado.
-- Se um lançamento for recusado (ex.: conta arquivada), os outros continuam: a falha fica registada
-- na recorrência e a data avança (a pessoa vê o aviso e regista-o à mão, se quiser).
create function public.gerar_recorrencias(p_hoje date)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.recorrencias;
  v_data date;
  v_criadas integer := 0;
  v_passos integer;
  v_falha text;
  v_falha_data date;
  v_hint text;
  v_estado text;
  v_conta public.accounts;
  v_categoria_arquivada boolean;
  v_compra_id uuid;
begin
  if p_hoje is null or p_hoje not between current_date - 1 and current_date + 1 then
    raise exception 'A data de hoje (%) não corresponde à do servidor', p_hoje
      using errcode = '22023', hint = 'recorrencias_hoje_check';
  end if;

  for r in
    select rc.*
    from public.recorrencias rc
    where rc.ativa and rc.proxima_data <= p_hoje
    order by rc.proxima_data, rc.id
    for update
  loop
    v_data := r.proxima_data;
    v_falha := null;
    v_falha_data := null;
    v_passos := 0;

    -- Os que faltam até hoje (um por mês ou por ano). O limite só protege de um ciclo sem fim.
    while v_data <= p_hoje and v_passos < 1200 loop
      begin
        select a.* into v_conta
        from public.accounts a
        where a.id = r.account_id and a.user_id = r.user_id;
        select c.arquivada into v_categoria_arquivada
        from public.categories c
        where c.id = r.category_id and c.user_id = r.user_id;

        if v_conta.arquivada or v_categoria_arquivada then
          raise exception 'A conta ou a categoria está arquivada'
            using errcode = '23514', hint = 'recorrencias_arquivada_check';
        end if;

        if v_conta.tipo = 'cartao_credito' then
          -- Compra à vista no cartão: entra na fatura da data, com as regras de qualquer compra
          v_compra_id := public.registar_compra_cartao(
            r.account_id, r.category_id, v_data, r.valor_centavos, 1, 1, r.descricao
          );
          update public.transactions t
          set recorrencia_id = r.id
          where t.compra_id = v_compra_id;
        else
          insert into public.transactions (
            account_id, category_id, tipo, valor_centavos, data, descricao, recorrencia_id
          ) values (
            r.account_id, r.category_id, r.tipo, r.valor_centavos, v_data, r.descricao, r.id
          );
        end if;
        v_criadas := v_criadas + 1;
      exception when others then
        -- Só este lançamento é desfeito (subtransação); a regra que o recusou fica registada
        get stacked diagnostics v_hint = pg_exception_hint, v_estado = returned_sqlstate;
        v_falha := left(coalesce(nullif(v_hint, ''), 'erro_' || v_estado), 100);
        v_falha_data := v_data;
      end;

      v_data := public.recorrencia_seguinte(v_data, r.frequencia, r.dia);
      v_passos := v_passos + 1;
    end loop;

    update public.recorrencias rc
    set
      proxima_data = v_data,
      falha = coalesce(v_falha, rc.falha),
      falha_data = case when v_falha is null then rc.falha_data else v_falha_data end
    where rc.id = r.id;
  end loop;

  return v_criadas;
end;
$$;

revoke all on function public.gerar_recorrencias(date) from public, anon;
grant execute on function public.gerar_recorrencias(date) to authenticated;
