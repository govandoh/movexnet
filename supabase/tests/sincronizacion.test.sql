-- Tests de la sincronización (issue #87, DEC-079): rutinas y objetivos por dueño, última
-- escritura gana, inserción idempotente de series y lo que el cliente no puede tocar.
begin;
select plan(27);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f1@test.local',
   '{"display_name":"Fer","birth_year":"1994","birth_month":"3","privacy_version":"privacy-2026-10-v1"}'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f2@test.local',
   '{"display_name":"Gabi","birth_year":"1992","birth_month":"7","privacy_version":"privacy-2026-10-v1"}');

-- Datos de B creados como superusuario.
insert into public.routines (id, user_id, name, days, updated_at) values
  ('60000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f2', 'De Gabi', '[]', '2026-10-01 10:00+00');
insert into public.goals (id, user_id, metric_name, target) values
  ('70000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f2', 'total_reps', 500);
insert into public.workout_sessions (id, user_id, started_at) values
  ('80000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f2', '2026-10-01 10:00+00');

-- ── Usuario A, como cliente ─────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';

-- Rutinas
select lives_ok(
  $$insert into public.routines (id, name, active, days, created_at, updated_at)
    values ('60000000-0000-0000-0000-0000000000f1', 'Pierna', true, '[{"id":"d1","weekday":1,"name":"Lunes","exercises":[]}]',
            '2026-10-01 09:00+00', '2026-10-02 10:00+00')$$,
  'A crea una rutina sin enviar user_id');
select is((select user_id from public.routines where id = '60000000-0000-0000-0000-0000000000f1'),
  '00000000-0000-0000-0000-0000000000f1'::uuid, 'la base pone el user_id de la sesión');
select is((select count(*)::int from public.routines), 1, 'A no ve las rutinas de B');
select throws_ok(
  $$insert into public.routines (id, user_id, name) values (gen_random_uuid(), '00000000-0000-0000-0000-0000000000f2', 'Intrusa')$$,
  '42501', null, 'A no crea rutinas a nombre de B');
select throws_ok(
  $$insert into public.routines (id, name, updated_at) values ('60000000-0000-0000-0000-0000000000f2', 'Pisada', '2030-01-01')
    on conflict (id) do update set name = excluded.name, updated_at = excluded.updated_at$$,
  '42501', null, 'A no pisa la rutina de B con un upsert');
update public.routines set name = 'Hackeada' where id = '60000000-0000-0000-0000-0000000000f2';
select throws_ok(
  $$insert into public.routines (id, name, days) values (gen_random_uuid(), 'Mala', '{"no":"lista"}')$$,
  '23514', null, 'los días de una rutina son una lista');

-- Última escritura gana
update public.routines set name = 'Vieja', updated_at = '2026-10-02 09:00+00' where id = '60000000-0000-0000-0000-0000000000f1';
select is((select name from public.routines where id = '60000000-0000-0000-0000-0000000000f1'), 'Pierna',
  'una escritura más vieja que la guardada se ignora');
insert into public.routines (id, name, updated_at) values ('60000000-0000-0000-0000-0000000000f1', 'Vieja', '2026-10-01 00:00+00')
  on conflict (id) do update set name = excluded.name, updated_at = excluded.updated_at;
select is((select name from public.routines where id = '60000000-0000-0000-0000-0000000000f1'), 'Pierna',
  'también con upsert');
insert into public.routines (id, name, active, updated_at) values ('60000000-0000-0000-0000-0000000000f1', 'Pierna y glúteo', false, '2026-10-03 10:00+00')
  on conflict (id) do update set name = excluded.name, active = excluded.active, updated_at = excluded.updated_at;
select is((select name || ' ' || active from public.routines where id = '60000000-0000-0000-0000-0000000000f1'), 'Pierna y glúteo false',
  'una escritura más nueva se aplica');
select lives_ok(
  $$delete from public.routines where id = '60000000-0000-0000-0000-0000000000f1'$$,
  'A borra su rutina');

-- Objetivos
select is((select count(*)::int from public.goals), 0, 'A no ve los objetivos de B');
insert into public.goals (id, metric_name, target, created_at, updated_at)
  values ('70000000-0000-0000-0000-0000000000f1', 'weekly_days', 3, '2026-10-01', '2026-10-02 10:00+00');
select is((select user_id from public.goals where id = '70000000-0000-0000-0000-0000000000f1'),
  '00000000-0000-0000-0000-0000000000f1'::uuid, 'el objetivo queda a nombre de A');
select throws_ok(
  $$insert into public.goals (metric_name, target, user_id) values ('total_sets', 10, '00000000-0000-0000-0000-0000000000f2')$$,
  '42501', null, 'A no crea objetivos a nombre de B');
update public.goals set target = 5, updated_at = '2026-10-01 00:00+00' where id = '70000000-0000-0000-0000-0000000000f1';
select is((select target::int from public.goals where id = '70000000-0000-0000-0000-0000000000f1'), 3,
  'un objetivo más viejo no pisa al guardado');
update public.goals set target = 4, updated_at = '2026-10-02 10:00+00' where id = '70000000-0000-0000-0000-0000000000f1';
select is((select target::int from public.goals where id = '70000000-0000-0000-0000-0000000000f1'), 4,
  'reintentar con la misma hora se aplica (idempotente)');

-- Sesiones y series
insert into public.workout_sessions (id, started_at) values ('80000000-0000-0000-0000-0000000000f1', '2026-10-05 10:00+00');
select is((select count(*)::int from public.workout_sessions), 1, 'A solo ve su sesión');
insert into public.workout_sessions (id, started_at) values ('80000000-0000-0000-0000-0000000000f1', '2026-10-05 10:00+00')
  on conflict (id) do nothing;
select is((select count(*)::int from public.workout_sessions), 1, 'reintentar la sesión no la duplica');
select throws_ok(
  $$update public.workout_sessions set started_at = '2026-10-05 20:00+00' where id = '80000000-0000-0000-0000-0000000000f1'$$,
  '42501', null, 'el inicio de una sesión no se mueve');
select lives_ok(
  $$update public.workout_sessions set ended_at = '2026-10-05 10:30+00' where id = '80000000-0000-0000-0000-0000000000f1'$$,
  'el cliente cierra su sesión');

insert into public.set_logs (id, session_id, exercise_id, reps, source, duration_ms, started_at) values
  ('90000000-0000-0000-0000-0000000000f1', '80000000-0000-0000-0000-0000000000f1', 'sentadilla', 10, 'camera', 25000, '2026-10-05 10:05+00');
insert into public.set_logs (id, session_id, exercise_id, reps, source, duration_ms, started_at) values
  ('90000000-0000-0000-0000-0000000000f1', '80000000-0000-0000-0000-0000000000f1', 'sentadilla', 10, 'camera', 25000, '2026-10-05 10:05+00')
  on conflict (id, started_at) do nothing;
select is((select count(*)::int from public.set_logs), 1, 'reintentar la serie no la duplica');
select is((select user_id from public.set_logs), '00000000-0000-0000-0000-0000000000f1'::uuid, 'la serie queda a nombre de A');
select throws_ok(
  $$insert into public.set_logs (session_id, exercise_id, reps, flag_reasons)
    values ('80000000-0000-0000-0000-0000000000f1', 'sentadilla', 5, '{}')$$,
  '42501', null, 'el cliente no envía flag_reasons');
select throws_ok(
  $$insert into public.set_logs (session_id, exercise_id, reps) values ('80000000-0000-0000-0000-0000000000f2', 'sentadilla', 5)$$,
  '42501', null, 'A no cuelga series de la sesión de B');

-- Métricas
insert into public.metrics (id, session_id, set_id, scope, name, value, unit) values
  ('a0000000-0000-0000-0000-0000000000f1', '80000000-0000-0000-0000-0000000000f1', '90000000-0000-0000-0000-0000000000f1',
   'set', 'clean_reps', 9, 'reps');
select throws_ok(
  $$update public.metrics set value = 10 where id = 'a0000000-0000-0000-0000-0000000000f1'$$,
  '42501', null, 'las métricas no se editan');

-- Perfil
select lives_ok(
  $$update public.profiles set program_started_at = '2026-10-01 12:00+00', days_per_week = 4$$,
  'A guarda el inicio del programa y el cuestionario');

-- ── Comprobaciones como superusuario ────────────────────────────────────────
reset role;
select is((select name from public.routines where id = '60000000-0000-0000-0000-0000000000f2'), 'De Gabi',
  'la rutina de B sigue intacta');
select is((select program_started_at from public.profiles where user_id = '00000000-0000-0000-0000-0000000000f2'), null,
  'el perfil de B no cambió');

select * from finish();
rollback;
