-- Etapa C2 (cartões): configuração de uma conta do tipo cartão de crédito.
-- Regras em docs/plano.md → "Cartões de crédito"; o mesmo cálculo em src/lib/credit-card.ts.
-- Só acrescenta colunas nulas: as contas existentes continuam válidas sem alterações.

alter table public.accounts
  add column dia_fechamento smallint,
  add column dia_vencimento smallint,
  -- Centavos inteiros; MAX_CENTS de src/lib/money.ts
  add column limite_centavos bigint,
  -- Conta (de dinheiro) de onde sai o pagamento da fatura
  add column conta_pagamento_id uuid;

alter table public.accounts
  -- Cartão ⇔ tem os quatro campos. Um cartão começa sem dívida: a dívida vem das compras.
  add constraint accounts_cartao_campos_check check (
    case
      when tipo = 'cartao_credito' then
        dia_fechamento is not null and dia_vencimento is not null and limite_centavos is not null
        and conta_pagamento_id is not null and saldo_inicial_centavos = 0
      else
        dia_fechamento is null and dia_vencimento is null and limite_centavos is null
        and conta_pagamento_id is null
    end
  ),
  -- Igual a validateCardConfig (src/lib/credit-card.ts), provado nos dois lados para os 961 pares:
  -- dias 1–31, diferentes, e fechamento ≤ 27 quando vence no mesmo mês (senão, em fevereiro, prazo 0).
  add constraint accounts_cartao_dias_check check (
    dia_fechamento between 1 and 31
    and dia_vencimento between 1 and 31
    and dia_fechamento <> dia_vencimento
    and not (dia_vencimento > dia_fechamento and dia_fechamento >= 28)
  ),
  add constraint accounts_limite_check check (limite_centavos between 1 and 99999999999),
  add constraint accounts_conta_pagamento_propria_check check (conta_pagamento_id <> id),
  -- FK COMPOSTA: a conta de pagamento tem de ser do mesmo utilizador (como nas transações).
  -- NO ACTION: não se apaga uma conta que paga um cartão; apagar o utilizador continua a funcionar.
  add constraint accounts_conta_pagamento_fk foreign key (conta_pagamento_id, user_id)
    references public.accounts (id, user_id) on delete no action;

create index accounts_conta_pagamento_idx on public.accounts (conta_pagamento_id);

-- As colunas novas são editáveis pelo dono (a RLS existente continua a decidir QUAIS linhas).
grant update (dia_fechamento, dia_vencimento, limite_centavos, conta_pagamento_id)
  on table public.accounts to authenticated;

-- Regras que precisam de ler outras linhas (um CHECK não consegue).
-- security invoker (o padrão): corre com as permissões de quem escreve, por isso a RLS aplica-se.
-- O nome da regra vai no HINT para a interface escolher a mensagem (src/features/accounts/accounts-api.ts).
create function public.check_account_cartao()
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

    -- Movimentos de uma conta de dinheiro e de um cartão têm regras diferentes: com movimentos,
    -- a conta não muda de/para cartão (os movimentos antigos ficariam com o significado errado).
    if (old.tipo = 'cartao_credito' or new.tipo = 'cartao_credito') and exists (
      select 1 from public.transactions t where t.account_id = new.id
    ) then
      raise exception 'Uma conta com transações não pode mudar de ou para cartão de crédito'
        using errcode = '23514', hint = 'accounts_tipo_cartao_em_uso_check';
    end if;
  end if;

  return new;
end;
$$;

create trigger accounts_check_cartao
  before insert or update of tipo, conta_pagamento_id on public.accounts
  for each row execute function public.check_account_cartao();

-- TEMPORÁRIO (até à etapa C3): compras no cartão vão ter fatura e parcelas e terão um fluxo
-- próprio. Até lá, uma receita/despesa normal não pode usar um cartão — assim não ficam
-- movimentos de cartão sem fatura que a C3 teria de corrigir.
create function public.check_transaction_account_not_card()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.accounts a
    where a.id = new.account_id and a.user_id = new.user_id and a.tipo = 'cartao_credito'
  ) then
    raise exception 'Compras no cartão de crédito ainda não podem ser registadas como transação'
      using errcode = '23514', hint = 'transactions_conta_cartao_check';
  end if;
  return new;
end;
$$;

create trigger transactions_check_account_not_card
  before insert or update of account_id on public.transactions
  for each row execute function public.check_transaction_account_not_card();
