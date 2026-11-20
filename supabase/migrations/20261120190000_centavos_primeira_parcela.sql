-- Centavos do arredondamento na PRIMEIRA parcela, como fazem os bancos (pedido de 2026-11-20: a fatura
-- do Picpay mostrava 1 ou 2 centavos de diferença por parcela). Ex.: R$ 59,00 em 3× = 19,68 + 19,66 + 19,66
-- (antes: 19,66 + 19,66 + 19,68). A soma é sempre o total.
--
-- Só as compras NOVAS usam a regra nova. As parcelas das compras antigas já estão guardadas (e nunca
-- se alteram nem se voltam a validar), por isso continuam certas; `centavos_na_primeira` diz à app
-- qual das regras cada compra usou, para mostrar a divisão (pré-visualização, detalhe) como foi feita.

alter table public.compras_cartao
  add column centavos_na_primeira boolean not null default false;
-- As compras que já existem ficaram com false (regra antiga); daqui para a frente, true.
alter table public.compras_cartao
  alter column centavos_na_primeira set default true;

comment on column public.compras_cartao.centavos_na_primeira is
  'true: o resto da divisão do total vai na 1.ª parcela (regra desde 2026-11-20); false: na última.';

-- Valor da parcela `numero` de `parcelas` — igual a splitInstallments: todas valem floor(total / n)
-- e a PRIMEIRA leva também o resto. Usada ao registar (registar_compra_cartao) e a validar (trigger
-- check_transaction_cartao) as parcelas novas.
create or replace function public.cartao_valor_parcela(total bigint, parcelas integer, numero integer)
returns bigint
language sql
immutable strict parallel safe
set search_path = ''
as $$
  select total / parcelas + case when numero = 1 then total % parcelas else 0 end
$$;
