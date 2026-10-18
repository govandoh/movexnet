-- Anti-trampa v1 y registro de uso del asistente (DEC-067, issue #65).

-- ── set_logs: origen, duración y marcas de plausibilidad ────────────────────
-- `source` decide si la serie puntúa en rankings: solo 'camera' (DEC-067 §3). El valor por
-- defecto es 'manual' para que una inserción que olvide el campo nunca puntúe por accidente.
alter table public.set_logs
  add column source       text not null default 'manual'
    check (source in ('camera', 'manual', 'imported')),
  -- Duración de la serie en ms; sin ella no se puede validar el mínimo de 800 ms por rep.
  add column duration_ms  integer check (duration_ms >= 0),
  add column flagged      boolean not null default false,
  add column flag_reasons text[] not null default '{}';

-- Función de plausibilidad. Marca, no rechaza: la serie se guarda en el historial del
-- usuario y solo queda fuera del ranking. Corre como el usuario (RLS aplica a sus lecturas).
-- Los umbrales son un punto de partida y se calibran con sesiones reales (DEC-067).
create function private.flag_set_log() returns trigger
language plpgsql set search_path = '' as $$
declare
  reasons  text[] := '{}';
  day_ms   bigint;
  day_from timestamptz := date_trunc('day', new.started_at at time zone 'UTC') at time zone 'UTC';
begin
  if new.reps > 100 then
    reasons := array_append(reasons, 'reps_gt_100');
  end if;
  if new.duration_ms is not null and new.reps > 0 and new.duration_ms / new.reps < 800 then
    reasons := array_append(reasons, 'rep_lt_800ms');
  end if;
  if new.duration_ms is not null then
    select coalesce(sum(s.duration_ms), 0) into day_ms
      from public.set_logs s
     where s.user_id = new.user_id
       and s.started_at >= day_from and s.started_at < day_from + interval '1 day'
       and s.id <> new.id;
    if day_ms + new.duration_ms > 3 * 3600 * 1000 then
      reasons := array_append(reasons, 'day_gt_3h');
    end if;
  end if;

  if tg_op = 'UPDATE' and current_user = 'authenticated' then
    -- El cliente no puede cambiar el origen ni liberar una marca; liberar es manual
    -- (service_role, tras revisión).
    new.source := old.source;
    new.flagged := old.flagged or cardinality(reasons) > 0;
    new.flag_reasons := (select coalesce(array_agg(distinct r), '{}')
                           from unnest(old.flag_reasons || reasons) as r);
  elsif tg_op = 'INSERT' then
    new.flagged := cardinality(reasons) > 0;
    new.flag_reasons := reasons;
  end if;
  return new;
end $$;

create trigger set_logs_flag
  before insert or update on public.set_logs
  for each row execute function private.flag_set_log();

-- Solapamiento: solo se puede evaluar al cerrar la sesión. Se comparan sesiones cerradas;
-- una sesión abandonada sin cerrar no marca a las siguientes. SECURITY DEFINER para poder
-- actualizar `flagged`, que el cliente no puede tocar.
create function private.flag_overlapping_sessions() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.ended_at is not null and exists (
    select 1 from public.workout_sessions o
     where o.user_id = new.user_id and o.id <> new.id and o.ended_at is not null
       and tstzrange(o.started_at, o.ended_at) && tstzrange(new.started_at, new.ended_at)
  ) then
    update public.set_logs
       set flagged = true,
           flag_reasons = (select coalesce(array_agg(distinct r), '{}')
                             from unnest(array_append(flag_reasons, 'sessions_overlap')) as r)
     where session_id = new.id and user_id = new.user_id;
  end if;
  return new;
end $$;

create trigger workout_sessions_flag_overlap
  after insert or update of ended_at, started_at on public.workout_sessions
  for each row execute function private.flag_overlapping_sessions();

-- ── Uso del asistente de IA (tope de costo por usuario) ─────────────────────
-- Lo escribe solo la Edge Function con service_role; el usuario lee el suyo para ver su
-- consumo. `cost_micro_usd`: millonésimas de dólar, para evitar decimales (DEC-067 §1).
create table public.coach_usage (
  user_id         uuid not null references auth.users (id) on delete cascade,
  -- Primer día del mes en UTC.
  period          date not null check (period = date_trunc('month', period)::date),
  calls           integer not null default 0 check (calls >= 0),
  input_tokens    bigint not null default 0 check (input_tokens >= 0),
  output_tokens   bigint not null default 0 check (output_tokens >= 0),
  cost_micro_usd  bigint not null default 0 check (cost_micro_usd >= 0),
  updated_at      timestamptz not null default now(),
  primary key (user_id, period)
);

alter table public.coach_usage enable row level security;
revoke all on public.coach_usage from anon;
revoke insert, update, delete on public.coach_usage from authenticated;

create policy coach_usage_select on public.coach_usage
  for select to authenticated
  using (user_id = (select auth.uid()));
