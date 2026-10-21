-- Etapa T1 (complemento): dívida anterior de uma pessoa (D23 em docs/plano.md).
--
-- O que a pessoa já devia antes de as suas compras estarem na app (ex.: faturas antigas que quem usa a
-- app pagou e que não foram registadas). Conta como já vencido no que a pessoa deve e é a primeira
-- coisa que os pagamentos dela abatem. Coluna nova com 0 por omissão: as pessoas existentes não mudam.

alter table public.pessoas
  add column divida_anterior_centavos bigint not null default 0,
  -- MAX_CENTS de src/lib/money.ts; um crédito a favor da pessoa regista-se como pagamento, não aqui
  add constraint pessoas_divida_anterior_check
    check (divida_anterior_centavos between 0 and 99999999999);

grant insert (divida_anterior_centavos) on table public.pessoas to authenticated;
grant update (divida_anterior_centavos) on table public.pessoas to authenticated;
