-- Etapa C5 (cartões): transferências entre contas próprias; o pagamento de uma fatura é uma
-- transferência da conta de dinheiro para o cartão, ligada à fatura.
-- Regras em docs/plano.md → "Cartões de crédito"; saldos em src/lib/finance.ts (transferMovements).
-- Só acrescenta: uma tabela nova e regras. Não altera dados existentes.
--
-- Sem dupla contagem: uma transferência NÃO é receita nem despesa (não tem categoria, não entra nos
-- gastos nem nos orçamentos); só move dinheiro entre contas, por isso o total das contas não muda.

create table public.transferencias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  conta_origem_id uuid not null,
  conta_destino_id uuid not null,
  -- Sempre positivo; MAX_CENTS de src/lib/money.ts
  valor_centavos bigint not null check (valor_centavos between 1 and 99999999999),
  data date not null default current_date check (data between date '1900-01-01' and date '2999-12-31'),
  descricao text not null default ''
    check (char_length(descricao) <= 120 and descricao = trim(descricao)),
  -- Preenchida = pagamento dessa fatura (o destino é o cartão da fatura)
  fatura_id uuid,
  created_at timestamptz not null default now(),

  constraint transferencias_contas_diferentes_check check (conta_origem_id <> conta_destino_id),
  -- FKs COMPOSTAS: as duas contas são do mesmo utilizador da transferência.
  -- NO ACTION: uma conta com transferências não se apaga; apagar o utilizador continua a funcionar.
  constraint transferencias_origem_fk foreign key (conta_origem_id, user_id)
    references public.accounts (id, user_id) on delete no action,
  constraint transferencias_destino_fk foreign key (conta_destino_id, user_id)
    references public.accounts (id, user_id) on delete no action,
  -- A fatura é do cartão de DESTINO e do mesmo utilizador (não se paga a fatura de outro cartão)
  constraint transferencias_fatura_fk foreign key (fatura_id, conta_destino_id, user_id)
    references public.faturas (id, account_id, user_id) on delete no action
);

comment on table public.transferencias is
  'Transferências entre contas próprias; com fatura_id é o pagamento de uma fatura de cartão.';

create index transferencias_user_data_idx on public.transferencias (user_id, data, id);
create index transferencias_origem_idx on public.transferencias (conta_origem_id);
create index transferencias_destino_idx on public.transferencias (conta_destino_id);
create index transferencias_fatura_idx on public.transferencias (fatura_id) where fatura_id is not null;

alter table public.transferencias enable row level security;

create policy "transferencias: ler as próprias"
  on public.transferencias for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "transferencias: criar para si"
  on public.transferencias for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "transferencias: apagar as próprias"
  on public.transferencias for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Sem update: um pagamento errado corrige-se apagando-o e registando-o de novo (fica tudo explícito).
revoke all on table public.transferencias from anon, authenticated;
grant select, delete on table public.transferencias to authenticated;
grant insert (conta_origem_id, conta_destino_id, valor_centavos, data, descricao, fatura_id)
  on table public.transferencias to authenticated;

-- Regras que precisam de ler as contas. security invoker (o padrão): a RLS aplica-se.
-- O nome da regra vai no HINT para a interface escolher a mensagem.
create function public.check_transferencia()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  origem_tipo public.tipo_conta;
  destino_tipo public.tipo_conta;
begin
  select a.tipo into origem_tipo
  from public.accounts a
  where a.id = new.conta_origem_id and a.user_id = new.user_id;
  select a.tipo into destino_tipo
  from public.accounts a
  where a.id = new.conta_destino_id and a.user_id = new.user_id;

  -- Na v1, o dinheiro não sai de um cartão por transferência (levantamentos/adiantamentos não existem).
  if origem_tipo = 'cartao_credito' then
    raise exception 'Uma transferência não pode sair de um cartão de crédito'
      using errcode = '23514', hint = 'transferencias_origem_cartao_check';
  end if;

  -- Dinheiro para um cartão é sempre o pagamento de uma fatura (a FK garante que é desse cartão).
  if destino_tipo = 'cartao_credito' and new.fatura_id is null then
    raise exception 'Um pagamento a um cartão tem de indicar a fatura'
      using errcode = '23514', hint = 'transferencias_cartao_sem_fatura_check';
  end if;

  -- D10a: sem pagamentos com data futura. Tolerância de 1 dia: current_date é a data UTC do
  -- servidor e o "hoje" de quem usa a app pode já ir no dia seguinte (ex.: Portugal no verão).
  if new.fatura_id is not null and new.data > current_date + 1 then
    raise exception 'Um pagamento de fatura não pode ter data futura'
      using errcode = '23514', hint = 'transferencias_pagamento_futuro_check';
  end if;

  return new;
end;
$$;

create trigger transferencias_check
  before insert on public.transferencias
  for each row execute function public.check_transferencia();

-- ---------------------------------------------------------------------------------------------------
-- D6: uma compra cujas parcelas estão em faturas com pagamentos não se apaga (o histórico pago fica
-- como está; a correção será um estorno, C8).

create function public.check_compra_cartao_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- pg_trigger_depth() = 1: só quando a compra é apagada diretamente. Em cascata (apagar o
  -- utilizador) o DELETE corre dentro da trigger da FK e é permitido, como nas parcelas (C3).
  if pg_trigger_depth() = 1 and exists (
    select 1
    from public.transactions t
    join public.transferencias p on p.fatura_id = t.fatura_id
    where t.compra_id = old.id
  ) then
    raise exception 'Esta compra tem parcelas em faturas com pagamentos e não pode ser apagada'
      using errcode = '23514', hint = 'compras_cartao_fatura_paga_check';
  end if;
  return old;
end;
$$;

create trigger compras_cartao_check_delete
  before delete on public.compras_cartao
  for each row execute function public.check_compra_cartao_delete();

-- ---------------------------------------------------------------------------------------------------
-- Contas: com transferências, uma conta também não muda de/para cartão.

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
