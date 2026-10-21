-- Anti-trampa v1.1 (issue #73, DEC-074). Precisa las reglas de DEC-067 §3 sin editar
-- 20261018000000_antitrampa_y_coach_usage.sql, que ya está aplicada en la nube.
--
-- 1. Una serie de cámara sin duración se marca `missing_duration`: sin duración se saltaba
--    las reglas de 800 ms por repetición y de 3 h al día.
-- 2. El día de la regla de 3 h se corta en hora de Guatemala, no en UTC (que lo cortaba a
--    las 18:00 locales). Igual que la puerta 18+ (20261020000000_edad_con_mes.sql).
-- 3. El solapamiento marca las series de las dos sesiones del par y compara también las
--    sesiones sin cerrar, con un fin efectivo de 3 h.
-- No cambian columnas: los tipos generados (src/domain/database.types.ts) siguen iguales.

-- ── Plausibilidad por serie ─────────────────────────────────────────────────
-- Sigue sin SECURITY DEFINER: corre como el usuario. Marca, no rechaza (DEC-067).
create or replace function private.flag_set_log() returns trigger
language plpgsql set search_path = '' as $$
declare
  reasons  text[] := '{}';
  day_ms   bigint;
  -- Medianoche de Guatemala del día de la serie, como timestamptz (ver DEC-074).
  day_from timestamptz := (date_trunc('day', new.started_at at time zone 'America/Guatemala'))
                            at time zone 'America/Guatemala';
begin
  -- El cliente no puede cambiar el origen. Se fija antes de evaluar para que las reglas
  -- usen el origen guardado y no el que manda el UPDATE.
  if tg_op = 'UPDATE' and current_user = 'authenticated' then
    new.source := old.source;
  end if;

  if new.reps > 100 then
    reasons := array_append(reasons, 'reps_gt_100');
  end if;
  if new.duration_ms is not null and new.reps > 0 and new.duration_ms / new.reps < 800 then
    reasons := array_append(reasons, 'rep_lt_800ms');
  end if;
  -- Una serie de cámara siempre trae duración (la mide el contador); si falta, no se
  -- pueden aplicar las reglas de 800 ms ni de 3 h y la serie queda fuera del ranking.
  if new.source = 'camera' and new.duration_ms is null then
    reasons := array_append(reasons, 'missing_duration');
  end if;
  if new.duration_ms is not null then
    -- Sin bloqueo: dos inserciones concurrentes del mismo día no se ven entre sí y pueden
    -- quedar las dos por debajo de 3 h. Riesgo aceptado en DEC-074.
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
    -- El cliente no puede liberar una marca; liberar es manual (service_role, tras revisión).
    new.flagged := old.flagged or cardinality(reasons) > 0;
    new.flag_reasons := (select coalesce(array_agg(distinct r), '{}')
                           from unnest(old.flag_reasons || reasons) as r);
  elsif tg_op = 'INSERT' then
    new.flagged := cardinality(reasons) > 0;
    new.flag_reasons := reasons;
  end if;
  return new;
end $$;

-- ── Solapamiento de sesiones ────────────────────────────────────────────────
-- Regla (DEC-074):
--   * Rango de una sesión: [started_at, fin efectivo). Fin efectivo = ended_at, o
--     started_at + 3 h si sigue abierta (el tope de actividad diaria de DEC-067).
--   * Solo participan sesiones con al menos una serie. Una sesión abandonada sin series no
--     es indicio de nada y no marca a la siguiente; una sesión recién creada todavía no
--     tiene series, así que la comparación real ocurre con su primera serie.
--   * Si dos sesiones del mismo usuario se solapan, se marcan con `sessions_overlap` las
--     series de las dos.
-- Se evalúa al crear o cerrar una sesión (trigger de workout_sessions, sin argumentos) y al
-- insertar o mover de sesión cada serie (trigger de set_logs, con el argumento 'set_logs').
-- Así se detectan también las sesiones que nunca se cierran.
--
-- SECURITY DEFINER porque el cliente no puede escribir `flagged`. El UPDATE de abajo corre
-- como el dueño de la función, no como 'authenticated', así que `flag_set_log()` no entra en
-- su rama del cliente y respeta las marcas que pone esta función. Las marcas solo se
-- añaden; nada de aquí las quita.
create or replace function private.flag_overlapping_sessions() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_session uuid;
begin
  -- Los triggers de una tabla particionada se clonan en cada partición y tg_table_name
  -- sería el de la partición; por eso el origen llega como argumento.
  if tg_nargs > 0 and tg_argv[0] = 'set_logs' then
    v_session := new.session_id;
  else
    v_session := new.id;
  end if;

  with me as (
    select s.id,
           tstzrange(s.started_at, coalesce(s.ended_at, s.started_at + interval '3 hours')) as r
      from public.workout_sessions s
     where s.id = v_session and s.user_id = new.user_id
       and exists (select 1 from public.set_logs l where l.session_id = s.id)
  ), others as (
    select o.id
      from public.workout_sessions o, me
     where o.user_id = new.user_id and o.id <> me.id
       and tstzrange(o.started_at, coalesce(o.ended_at, o.started_at + interval '3 hours')) && me.r
       and exists (select 1 from public.set_logs l where l.session_id = o.id)
  ), pair as (
    select id from others
    union
    select id from me where exists (select 1 from others)
  )
  update public.set_logs l
     set flagged = true,
         flag_reasons = array_append(l.flag_reasons, 'sessions_overlap')
   where l.user_id = new.user_id
     and l.session_id in (select id from pair)
     and not ('sessions_overlap' = any (l.flag_reasons));

  return new;
end $$;

-- El trigger de workout_sessions (after insert or update of ended_at, started_at) ya existe
-- y usa la función nueva sin cambios. Falta evaluar al insertar cada serie y cuando el
-- cliente la mueve de sesión. El UPDATE de la función solo toca flagged y flag_reasons, así
-- que no vuelve a disparar este trigger.
create trigger set_logs_flag_overlap
  after insert or update of session_id, started_at on public.set_logs
  for each row execute function private.flag_overlapping_sessions('set_logs');
