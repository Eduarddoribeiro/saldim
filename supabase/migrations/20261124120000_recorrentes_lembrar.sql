-- Recorrentes "só lembrar" (pedido de 2026-11-24): gastos de todos os meses cujo dia varia (UniTV,
-- corte de cabelo) ou cujo valor varia (assinatura em dólar). Não se lançam sozinhos: a app mostra-os
-- como previstos até haver no mês um lançamento com o mesmo nome (features/recurring/projection.ts).
-- O modo 'automatico' é o de sempre (gerar_recorrencias lança-os no dia).

alter table public.recorrencias
  add column modo text not null default 'automatico'
    constraint recorrencias_modo_check check (modo in ('automatico', 'lembrar'));

comment on column public.recorrencias.modo is
  'automatico: gerar_recorrencias lança no dia; lembrar: só aparece como previsto até ser registado.';

grant insert (modo), update (modo) on table public.recorrencias to authenticated;

-- A mesma função, a saltar os "só lembrar" (para esses, só avança a próxima data, que assim nunca
-- fica no passado).
create or replace function public.gerar_recorrencias(p_hoje date)
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
      -- "Só lembrar": nunca se lança sozinho (o dia ou o valor variam); só a data avança
      if r.modo = 'lembrar' then
        v_data := public.recorrencia_seguinte(v_data, r.frequencia, r.dia);
        v_passos := v_passos + 1;
        continue;
      end if;
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

