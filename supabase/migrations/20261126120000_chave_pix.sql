-- Chave Pix do dono para quem vê o que deve (pedido de 2026-11-25: o app da mãe "mais simples",
-- com um botão para copiar a chave Pix e pagar). A chave é opcional, guardada no perfil, e só sai da
-- base de dados para as pessoas ligadas ao dono, pela função divida_partilhada (que ganha a coluna
-- dono_chave_pix). Mudar as colunas devolvidas obriga a apagar e criar de novo as duas funções.

alter table public.profiles
  add column chave_pix text
  constraint profiles_chave_pix_check
    check (chave_pix is null or char_length(chave_pix) between 1 and 120);

comment on column public.profiles.chave_pix is
  'Chave Pix (opcional) mostrada a quem vê o que deve ao dono (divida_partilhada).';

grant update (chave_pix) on table public.profiles to authenticated;

drop function public.divida_partilhada();
drop function private.divida_partilhada();

create function private.divida_partilhada()
returns table (
  pessoa_id uuid,
  pessoa_nome text,
  dono_nome text,
  divida_anterior_centavos bigint,
  compras jsonb,
  movimentos jsonb,
  faturas jsonb,
  cartoes jsonb,
  categorias jsonb,
  reembolsos jsonb,
  dono_chave_pix text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.nome,
    coalesce(nullif(pr.nome, ''), ''),
    p.divida_anterior_centavos,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'account_id', c.account_id, 'category_id', c.category_id,
        'descricao', c.descricao, 'data_compra', c.data_compra,
        'valor_total_centavos', c.valor_total_centavos, 'parcelas', c.parcelas,
        'parcela_inicial', c.parcela_inicial, 'pessoa_id', c.pessoa_id
      ) order by c.data_compra, c.id)
      from public.compras_cartao c where c.pessoa_id = p.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'tipo', t.tipo, 'valor_centavos', t.valor_centavos, 'data', t.data,
        'account_id', t.account_id, 'fatura_id', t.fatura_id, 'compra_id', t.compra_id,
        'pessoa_id', t.pessoa_id
      ) order by t.data, t.id)
      from public.transactions t where t.pessoa_id = p.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'data_vencimento', f.data_vencimento))
      from public.faturas f
      where f.id in (select t.fatura_id from public.transactions t where t.pessoa_id = p.id)
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome))
      from public.accounts a
      where a.id in (select c.account_id from public.compras_cartao c where c.pessoa_id = p.id)
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', k.id, 'nome', k.nome, 'cor', k.cor, 'icone', k.icone
      ))
      from public.categories k
      where k.id in (select c.category_id from public.compras_cartao c where c.pessoa_id = p.id)
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'valor_centavos', r.valor_centavos, 'data', r.data, 'descricao', r.descricao
      ) order by r.data, r.id)
      from public.reembolsos r where r.pessoa_id = p.id
    ), '[]'::jsonb),
    pr.chave_pix
  from public.pessoas p
  left join public.profiles pr on pr.id = p.user_id
  where p.viewer_id = auth.uid() and auth.uid() is not null and not p.arquivada
  order by p.nome;
$$;

create function public.divida_partilhada()
returns table (
  pessoa_id uuid,
  pessoa_nome text,
  dono_nome text,
  divida_anterior_centavos bigint,
  compras jsonb,
  movimentos jsonb,
  faturas jsonb,
  cartoes jsonb,
  categorias jsonb,
  reembolsos jsonb,
  dono_chave_pix text
)
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.divida_partilhada() $$;

revoke all on function private.divida_partilhada() from public, anon;
grant execute on function private.divida_partilhada() to authenticated;
revoke all on function public.divida_partilhada() from public, anon;
grant execute on function public.divida_partilhada() to authenticated;
