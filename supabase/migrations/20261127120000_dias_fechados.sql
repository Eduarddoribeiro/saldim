-- Fechar o dia (gamificação, pedido de 2026-11-26; docs/features/jornada.md): um toque em "lancei
-- tudo de hoje" ou "não gastei nada" guarda o dia. A sequência, as estrelas e as conquistas são
-- calculadas na app a partir destes dias e dos dados que já existem; não se guardam pontos.

create table public.dias_fechados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- O dia LOCAL de quem fechou (a app envia todayIso)
  dia date not null,
  created_at timestamptz not null default now(),

  constraint dias_fechados_dia_unico unique (user_id, dia)
);

comment on table public.dias_fechados is
  'Dias que o utilizador fechou ("lancei tudo de hoje"), para a sequência e as estrelas.';

alter table public.dias_fechados enable row level security;

create policy "dias_fechados: ler os próprios"
  on public.dias_fechados for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "dias_fechados: criar para si"
  on public.dias_fechados for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "dias_fechados: apagar os próprios"
  on public.dias_fechados for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.dias_fechados from anon, authenticated;
grant select, delete on table public.dias_fechados to authenticated;
grant insert (dia) on table public.dias_fechados to authenticated;

-- Só se fecha o dia de hoje (com um dia de folga para os fusos horários): não se fecham dias
-- passados para encher a sequência nem dias futuros.
create function public.check_dia_fechado()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.dia < current_date - 1 or new.dia > current_date + 1 then
    raise exception 'Só dá para fechar o dia de hoje.'
      using errcode = '23514', hint = 'dias_fechados_hoje_check';
  end if;
  return new;
end;
$$;

create trigger dias_fechados_check
  before insert on public.dias_fechados
  for each row execute function public.check_dia_fechado();
