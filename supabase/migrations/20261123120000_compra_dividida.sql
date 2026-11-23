-- Compra dividida com outra pessoa (pedido de 2026-11-23): uma compra no cartão que é metade minha e
-- metade da Mãe regista-se como DUAS compras (a minha e a dela, com pessoa_id), na mesma transação:
-- ou ficam as duas, ou nenhuma. As partes vêm calculadas da app (halfSplit em src/lib/credit-card.ts,
-- para as parcelas somarem a parcela do banco), ou escritas à mão.
--
-- security invoker: corre com as permissões de quem chama, por isso a RLS, as constraints e as
-- triggers de registar_compra_cartao valem para as duas compras.

create function public.registar_compra_dividida(
  p_account_id uuid,
  p_category_id uuid,
  p_data_compra date,
  p_valor_meu_centavos bigint,
  p_valor_pessoa_centavos bigint,
  p_parcelas integer,
  p_pessoa_id uuid,
  p_parcela_inicial integer default 1,
  p_descricao text default ''
)
returns uuid[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_minha uuid;
  v_dela uuid;
begin
  if p_pessoa_id is null then
    raise exception 'Uma compra dividida precisa da pessoa' using errcode = '23514',
      hint = 'compra_dividida_pessoa_check';
  end if;
  v_minha := public.registar_compra_cartao(
    p_account_id, p_category_id, p_data_compra, p_valor_meu_centavos, p_parcelas,
    p_parcela_inicial, p_descricao, null
  );
  v_dela := public.registar_compra_cartao(
    p_account_id, p_category_id, p_data_compra, p_valor_pessoa_centavos, p_parcelas,
    p_parcela_inicial, p_descricao, p_pessoa_id
  );
  return array[v_minha, v_dela];
end;
$$;

revoke all on function public.registar_compra_dividida(uuid, uuid, date, bigint, bigint, integer, uuid, integer, text)
  from public, anon;
grant execute on function public.registar_compra_dividida(uuid, uuid, date, bigint, bigint, integer, uuid, integer, text)
  to authenticated;
