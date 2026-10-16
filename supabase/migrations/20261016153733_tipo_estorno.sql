-- Etapa C8 (cartões): novo tipo de movimento para os estornos (D9a).
-- Migration à parte de propósito: o Postgres não deixa USAR um valor novo de um enum na mesma
-- transação em que ele é criado, e a migration seguinte usa-o nos CHECKs e triggers.
-- O enum é partilhado com as categorias: a migration seguinte impede categorias do tipo estorno.

alter type public.tipo_movimento add value if not exists 'estorno';
