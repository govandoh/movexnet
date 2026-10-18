-- Tests de RLS con pgTAP. Se ejecutan con `pnpm db:test` (supabase test db).
-- Criterio de la issue #17: un usuario no lee ni escribe datos de otro.
begin;
select plan(47);

-- Dos usuarios y un anónimo. Las filas se crean como superusuario (sin RLS).
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local');

insert into public.profiles (user_id, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'Ana'),
  ('00000000-0000-0000-0000-00000000000b', 'Beto');

insert into public.workout_sessions (id, user_id) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b');

insert into public.set_logs (user_id, session_id, exercise_id, reps) values
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'sentadilla', 10),
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'sentadilla', 8);

insert into public.metrics (user_id, session_id, scope, name, value, unit) values
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'session', 'form_score', 80, 'pct');

insert into public.recording_consents (id, user_id, text_version) values
  ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'v1'),
  ('20000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'v1');

-- ── Usuario A ───────────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is((select count(*)::int from public.profiles), 1, 'A solo ve su perfil');
select is((select count(*)::int from public.workout_sessions), 1, 'A solo ve su sesión');
select is((select count(*)::int from public.set_logs), 1, 'A solo ve sus series');
select is((select count(*)::int from public.metrics), 0, 'A no ve métricas de B');
select is((select count(*)::int from public.recording_consents), 1, 'A solo ve su consentimiento');
select is((select count(*)::int from public.exercises), 60, 'A lee el catálogo completo');
select is((select preferred_camera from public.profiles), 'environment', 'la cámara por defecto es la trasera, como en la app');

select throws_ok(
  $$insert into public.profiles (user_id, display_name) values ('00000000-0000-0000-0000-00000000000b', 'Intruso')$$,
  '42501', null, 'A no puede crear el perfil de B');

select throws_ok(
  $$insert into public.set_logs (user_id, session_id, exercise_id)
    values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000b', 'sentadilla')$$,
  '42501', null, 'A no puede colgar una serie de la sesión de B');

select throws_ok(
  $$insert into public.set_logs (user_id, session_id, exercise_id)
    values ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'sentadilla')$$,
  '42501', null, 'A no puede crear series a nombre de B');

select throws_ok(
  $$insert into public.recordings (user_id, consent_id, exercise_id, view, storage_path)
    values ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000b', 'sentadilla', 'front', 'a/1.json')$$,
  '42501', null, 'A no puede grabar con el consentimiento de B');

select lives_ok(
  $$insert into public.recordings (user_id, consent_id, exercise_id, view, storage_path)
    values ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'sentadilla', 'front', 'a/1.json')$$,
  'A graba con su consentimiento vigente');

select throws_ok(
  $$insert into public.recordings (user_id, consent_id, exercise_id, view, storage_path)
    values ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'sentadilla', 'back', 'a/view.json')$$,
  '23514', null, 'la vista de una grabación solo puede ser side, front o 45');

select throws_ok(
  $$insert into public.recordings (user_id, consent_id, exercise_id, view, storage_path)
    values ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'sentadilla', 'front', 'a/dup.json')$$,
  '23505', null, 'un consentimiento no sirve para dos grabaciones');

-- UPDATE/DELETE sobre filas ajenas no falla: RLS las oculta y afecta 0 filas.
update public.profiles set display_name = 'Hackeado' where user_id = '00000000-0000-0000-0000-00000000000b';
delete from public.workout_sessions where id = '10000000-0000-0000-0000-00000000000b';

select throws_ok(
  $$insert into public.exercises (id, name_es, muscle_group, base_difficulty, tracking, movement_pattern, equipment, equipment_label, cues)
    values ('x', 'x', 'core', 'bajo', 'reps', 'core', '[]', 'x', 'x')$$,
  '42501', null, 'A no puede escribir el catálogo');

-- Privilegios que RLS no cubre.
select throws_ok($$truncate public.set_logs$$, '42501', null, 'A no puede hacer TRUNCATE de series');
select throws_ok($$select * from public.set_logs_default$$, '42501', null,
  'A no puede consultar una partición de set_logs directamente');
select is(
  (select count(*)::int from pg_inherits i
   where i.inhparent = 'public.set_logs'::regclass
     and (has_table_privilege('authenticated', i.inhrelid, 'select,insert,update,delete')
          or has_table_privilege('anon', i.inhrelid, 'select,insert,update,delete')
          or not (select relrowsecurity from pg_class where oid = i.inhrelid))),
  0, 'ninguna partición de set_logs queda expuesta ni sin RLS');
select throws_ok(
  $$update public.recordings set retention_until = now() + interval '100 years'$$,
  '42501', null, 'A no puede ampliar la retención de su grabación');
select throws_ok(
  $$insert into public.recording_consents (user_id, text_version, granted_at)
    values ('00000000-0000-0000-0000-00000000000a', 'v1', now() - interval '1 year')$$,
  '42501', null, 'A no puede fijar granted_at de un consentimiento');
select throws_ok($$delete from public.recording_consents$$, '42501', null, 'A no puede borrar consentimientos');

-- Revocar el consentimiento bloquea nuevas grabaciones y es definitivo.
update public.recording_consents set revoked_at = now() where id = '20000000-0000-0000-0000-00000000000a';
select throws_ok(
  $$insert into public.recordings (user_id, consent_id, exercise_id, view, storage_path)
    values ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-00000000000a', 'sentadilla', 'front', 'a/2.json')$$,
  '42501', null, 'con el consentimiento revocado no se pueden crear grabaciones');
select throws_ok(
  $$update public.recording_consents set revoked_at = null where id = '20000000-0000-0000-0000-00000000000a'$$,
  'P0001', null, 'una revocación no se puede deshacer');
select is(
  (select retention_until <= now() from public.recordings where storage_path = 'a/1.json'),
  true, 'revocar el consentimiento vence la grabación asociada');

select is((select count(*)::int from public.recordings), 1, 'A puede ver (y borrar) su grabación ya creada');

-- ── Usuario B: lo de A no le afectó ni lo ve ────────────────────────────────
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';

select is((select display_name from public.profiles), 'Beto', 'el UPDATE de A no tocó el perfil de B');
select is((select count(*)::int from public.workout_sessions), 1, 'el DELETE de A no borró la sesión de B');
select is((select count(*)::int from public.metrics), 1, 'B ve sus métricas');
select is((select count(*)::int from public.recordings), 0, 'B no ve grabaciones de A');
select is((select count(*)::int from public.set_logs), 1, 'B solo ve sus series');

-- ── Anti-trampa y coach_usage (DEC-067, issue #65) ──────────────────────────
reset role;
insert into public.coach_usage (user_id, period, calls, cost_micro_usd) values
  ('00000000-0000-0000-0000-00000000000a', date_trunc('month', now())::date, 3, 120000),
  ('00000000-0000-0000-0000-00000000000b', date_trunc('month', now())::date, 9, 900000);

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is((select count(*)::int from public.coach_usage), 1, 'A solo ve su uso del asistente');
select throws_ok($$insert into public.coach_usage (user_id, period) values ('00000000-0000-0000-0000-00000000000a', '2030-01-01')$$,
  '42501', null, 'A no escribe su uso del asistente');
select throws_ok($$update public.coach_usage set cost_micro_usd = 0$$,
  '42501', null, 'A no edita su uso del asistente');

insert into public.set_logs (id, user_id, session_id, exercise_id, reps, source, duration_ms) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'sentadilla', 10, 'camera', 20000),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'sentadilla', 150, 'camera', 300000),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'sentadilla', 10, 'camera', 5000);
insert into public.set_logs (id, user_id, session_id, exercise_id, reps, flagged) values
  ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'sentadilla', 5, true);

select is((select flagged from public.set_logs where id = '30000000-0000-0000-0000-000000000001'), false, 'una serie plausible no se marca');
select is((select flag_reasons from public.set_logs where id = '30000000-0000-0000-0000-000000000002'), array['reps_gt_100'], 'más de 100 reps se marca');
select is((select flag_reasons from public.set_logs where id = '30000000-0000-0000-0000-000000000003'), array['rep_lt_800ms'], 'menos de 800 ms por rep se marca');
select is((select source from public.set_logs where id = '30000000-0000-0000-0000-000000000004'), 'manual', 'el origen por defecto es manual');
select is((select flagged from public.set_logs where id = '30000000-0000-0000-0000-000000000004'), false, 'el cliente no puede fijar flagged al insertar');
select throws_ok($$insert into public.set_logs (user_id, session_id, exercise_id, source) values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'sentadilla', 'otro')$$,
  '23514', null, 'origen inválido rechazado');

update public.set_logs set flagged = false, source = 'manual' where id = '30000000-0000-0000-0000-000000000002';
select is((select flagged and source = 'camera' from public.set_logs where id = '30000000-0000-0000-0000-000000000002'), true, 'el cliente no libera una marca ni cambia el origen');

insert into public.set_logs (user_id, session_id, exercise_id, reps, source, duration_ms) values
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'sentadilla', 100, 'camera', 11000000);
select is((select 'day_gt_3h' = any(flag_reasons) from public.set_logs where duration_ms = 11000000), true, 'más de 3 h de actividad en el día se marca');

insert into public.workout_sessions (id, user_id, started_at, ended_at) values
  ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', now() - interval '3 hours', now() - interval '1 hour');
insert into public.workout_sessions (id, user_id, started_at) values
  ('10000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a', now() - interval '90 minutes');
insert into public.set_logs (id, user_id, session_id, exercise_id, reps, source, duration_ms) values
  ('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-0000000000a2', 'sentadilla', 10, 'camera', 20000);
update public.workout_sessions set ended_at = now() - interval '30 minutes' where id = '10000000-0000-0000-0000-0000000000a2';
select is((select 'sessions_overlap' = any(flag_reasons) from public.set_logs where id = '30000000-0000-0000-0000-000000000005'), true, 'sesiones solapadas marcan sus series');

-- ── Anónimo ─────────────────────────────────────────────────────────────────
set local role anon;
set local request.jwt.claims to '';

-- anon no tiene privilegios sobre ninguna tabla de public.
select throws_ok($$select * from public.profiles$$, '42501', null, 'anon no lee perfiles');
select throws_ok($$select * from public.set_logs$$, '42501', null, 'anon no lee series');
select throws_ok($$select * from public.exercises$$, '42501', null, 'anon no lee el catálogo');
select throws_ok($$select * from public.set_logs_default$$, '42501', null, 'anon no lee particiones');
-- La única puerta de anon es el ping de keepalive.
select is((select public.keepalive() is not null), true, 'anon puede llamar a keepalive()');

select * from finish();
rollback;
