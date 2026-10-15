-- Etapa C2 (cartões): novo tipo de conta.
-- Migration à parte de propósito: o Postgres não deixa USAR um valor novo de um enum na mesma
-- transação em que ele é criado, e a migration seguinte usa-o nos CHECKs e triggers.

alter type public.tipo_conta add value 'cartao_credito';
