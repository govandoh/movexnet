-- Tests de anti-trampa v1.1 (issue #73, DEC-074): series de cámara sin duración, día en hora
-- de Guatemala y solapamiento en las dos sesiones, incluidas las que no se cierran.
-- Las reglas de v1 (100 reps, 800 ms, 3 h, origen) se prueban en rls.test.sql.
-- Fechas fijas en septiembre de 2026; Guatemala es UTC-6 todo el año.
begin;
select plan(16);

-- Un usuario por escenario para que los totales del día y los solapamientos no se mezclen.
-- El trigger de cuentas exige nombre, año, mes y aviso vigente (DEC-069).
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000000e' || n)::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated', 'authenticated', 'e' || n || '@test.local',
       jsonb_build_object('display_name', 'Prueba ' || n, 'birth_year', '1995', 'birth_month', '4',
                          'privacy_version', 'privacy-2026-10-v1')
  from generate_series(1, 5) as n;

-- ── Series de cámara sin duración (usuario e1) ──────────────────────────────

insert into public.workout_sessions (id, user_id, started_at, ended_at) values
  ('40000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e1',
   '2026-09-01 10:00+00', '2026-09-01 11:00+00');
insert into public.set_logs (id, user_id, session_id, exercise_id, reps, source, started_at) values
  ('50000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-0000000000e1',
   '40000000-0000-0000-0000-0000000000e1', 'sentadilla', 10, 'camera', '2026-09-01 10:05+00'),
  ('50000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-0000000000e1',
   '40000000-0000-0000-0000-0000000000e1', 'sentadilla', 10, 'manual', '2026-09-01 10:10+00');

select is((select flagged::text || ' ' || flag_reasons::text from public.set_logs
            where id = '50000000-0000-0000-0000-000000000101'),
  'true {missing_duration}', 'serie de cámara sin duración: se guarda y queda marcada missing_duration');
select is((select flagged from public.set_logs where id = '50000000-0000-0000-0000-000000000102'),
  false, 'serie manual sin duración: no se marca');

-- ── Día en hora de Guatemala (usuario e2) ───────────────────────────────────
-- 17:30 y 18:30 locales son 23:30 UTC y 00:30 UTC del día siguiente: en UTC eran días
-- distintos. 2 h + 2 h en el mismo día local supera las 3 h.

insert into public.workout_sessions (id, user_id, started_at, ended_at) values
  ('40000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e2',
   '2026-09-01 23:00+00', '2026-09-02 03:00+00'),
  ('40000000-0000-0000-0000-0000000002e2', '00000000-0000-0000-0000-0000000000e2',
   '2026-09-02 06:00+00', '2026-09-02 09:00+00');
insert into public.set_logs (id, user_id, session_id, exercise_id, reps, source, duration_ms, started_at) values
  ('50000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-0000000000e2',
   '40000000-0000-0000-0000-0000000000e2', 'sentadilla', 100, 'camera', 7200000, '2026-09-01 17:30-06');
insert into public.set_logs (id, user_id, session_id, exercise_id, reps, source, duration_ms, started_at) values
  ('50000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-0000000000e2',
   '40000000-0000-0000-0000-0000000000e2', 'sentadilla', 100, 'camera', 7200000, '2026-09-01 18:30-06');
insert into public.set_logs (id, user_id, session_id, exercise_id, reps, source, duration_ms, started_at) values
  ('50000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-0000000000e2',
   '40000000-0000-0000-0000-0000000002e2', 'sentadilla', 100, 'camera', 7200000, '2026-09-02 00:30-06');

select is((select flagged from public.set_logs where id = '50000000-0000-0000-0000-000000000201'),
  false, 'primera serie del día (17:30 local, 2 h): no se marca');
select is((select flag_reasons from public.set_logs where id = '50000000-0000-0000-0000-000000000202'),
  array['day_gt_3h'], '18:30 local cuenta en el mismo día que 17:30: más de 3 h, se marca');
select is((select flagged from public.set_logs where id = '50000000-0000-0000-0000-000000000203'),
  false, '00:30 local del día siguiente empieza otro día: no se marca');

-- ── Dos sesiones cerradas que se solapan al cerrar (usuario e3) ─────────────
-- S1 abierta desde las 08:00 (fin efectivo 11:00) y S2 de 11:30 a 12:00: no se solapan
-- hasta que S1 se cierra a las 12:00. El cierre marca las series de las dos.

insert into public.workout_sessions (id, user_id, started_at) values
  ('40000000-0000-0000-0000-0000000001e3', '00000000-0000-0000-0000-0000000000e3', '2026-09-03 08:00+00');
insert into public.set_logs (id, user_id, session_id, exercise_id, reps, source, duration_ms, started_at) values
  ('50000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-0000000000e3',
   '40000000-0000-0000-0000-0000000001e3', 'sentadilla', 10, 'camera', 20000, '2026-09-03 08:05+00');
insert into public.workout_sessions (id, user_id, started_at, ended_at) values
  ('40000000-0000-0000-0000-0000000002e3', '00000000-0000-0000-0000-0000000000e3',
   '2026-09-03 11:30+00', '2026-09-03 12:00+00');
insert into public.set_logs (id, user_id, session_id, exercise_id, reps, source, duration_ms, started_at) values
  ('50000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-0000000000e3',
   '40000000-0000-0000-0000-0000000002e3', 'sentadilla', 10, 'camera', 20000, '2026-09-03 11:35+00');

select is((select count(*)::int from public.set_logs
            where user_id = '00000000-0000-0000-0000-0000000000e3' and flagged),
  0, 'antes del cierre las dos sesiones no se solapan');

update public.workout_sessions set ended_at = '2026-09-03 12:00+00'
 where id = '40000000-0000-0000-0000-0000000001e3';

select is((select flag_reasons from public.set_logs where id = '50000000-0000-0000-0000-000000000301'),
  array['sessions_overlap'], 'al cerrar, se marcan las series de la sesión que se cierra');
select is((select flag_reasons from public.set_logs where id = '50000000-0000-0000-0000-000000000302'),
  array['sessions_overlap'], 'y también las de la otra sesión del par');

-- ── Sesión abierta y vieja con series (usuario e4, como cliente) ────────────
-- Vieja: abierta desde las 10:00, fin efectivo 13:00. Nueva a las 12:00: se solapa.
-- Otra a las 13:30: fuera del fin efectivo. Todo como el cliente, para probar que el UPDATE
-- de la función SECURITY DEFINER no choca con la rama del cliente de flag_set_log().

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e4","role":"authenticated"}';

insert into public.workout_sessions (id, user_id, started_at) values
  ('40000000-0000-0000-0000-0000000001e4', '00000000-0000-0000-0000-0000000000e4', '2026-09-04 10:00+00');
insert into public.set_logs (id, user_id, session_id, exercise_id, reps, source, duration_ms, started_at) values
  ('50000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-0000000000e4',
   '40000000-0000-0000-0000-0000000001e4', 'sentadilla', 10, 'camera', 20000, '2026-09-04 10:05+00');
insert into public.workout_sessions (id, user_id, started_at) values
  ('40000000-0000-0000-0000-0000000002e4', '00000000-0000-0000-0000-0000000000e4', '2026-09-04 12:00+00');
insert into public.set_logs (id, user_id, session_id, exercise_id, reps, source, duration_ms, started_at) values
  ('50000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-0000000000e4',
   '40000000-0000-0000-0000-0000000002e4', 'sentadilla', 10, 'camera', 20000, '2026-09-04 12:05+00');

select is((select flag_reasons from public.set_logs where id = '50000000-0000-0000-0000-000000000401'),
  array['sessions_overlap'], 'sesión abierta y vieja: sus series se marcan al llegar la nueva');
select is((select flag_reasons from public.set_logs where id = '50000000-0000-0000-0000-000000000402'),
  array['sessions_overlap'], 'la serie de la sesión nueva también se marca');

-- La nueva (12:00, abierta) llega hasta las 15:00; esta empieza después de su fin efectivo.
insert into public.workout_sessions (id, user_id, started_at, ended_at) values
  ('40000000-0000-0000-0000-0000000003e4', '00000000-0000-0000-0000-0000000000e4',
   '2026-09-04 15:30+00', '2026-09-04 16:00+00');
insert into public.set_logs (id, user_id, session_id, exercise_id, reps, source, duration_ms, started_at) values
  ('50000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-0000000000e4',
   '40000000-0000-0000-0000-0000000003e4', 'sentadilla', 10, 'camera', 20000, '2026-09-04 15:35+00');
select is((select flagged from public.set_logs where id = '50000000-0000-0000-0000-000000000403'),
  false, 'después del fin efectivo de 3 h ya no hay solapamiento');

-- Mover una serie limpia a una sesión solapada también la marca.
update public.set_logs set session_id = '40000000-0000-0000-0000-0000000002e4'
 where id = '50000000-0000-0000-0000-000000000403';
select is((select flag_reasons from public.set_logs where id = '50000000-0000-0000-0000-000000000403'),
  array['sessions_overlap'], 'mover una serie a una sesión solapada la marca');

-- El cliente no puede liberar ni quitar sessions_overlap.
update public.set_logs set flagged = false, flag_reasons = '{}'
 where id = '50000000-0000-0000-0000-000000000401';
select is((select flagged::text || ' ' || flag_reasons::text from public.set_logs
            where id = '50000000-0000-0000-0000-000000000401'),
  'true {sessions_overlap}', 'el cliente no libera ni quita sessions_overlap');

-- ── Sesión abandonada sin series (usuario e5) ───────────────────────────────

reset role;
insert into public.workout_sessions (id, user_id, started_at) values
  ('40000000-0000-0000-0000-0000000001e5', '00000000-0000-0000-0000-0000000000e5', '2026-09-05 10:00+00');
insert into public.workout_sessions (id, user_id, started_at, ended_at) values
  ('40000000-0000-0000-0000-0000000002e5', '00000000-0000-0000-0000-0000000000e5',
   '2026-09-05 11:00+00', '2026-09-05 12:00+00');
insert into public.set_logs (id, user_id, session_id, exercise_id, reps, source, duration_ms, started_at) values
  ('50000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-0000000000e5',
   '40000000-0000-0000-0000-0000000002e5', 'sentadilla', 10, 'camera', 20000, '2026-09-05 11:05+00');
select is((select flagged from public.set_logs where id = '50000000-0000-0000-0000-000000000501'),
  false, 'una sesión abierta abandonada sin series no marca a la siguiente');

-- ── El cliente no quita missing_duration (usuario e1) ───────────────────────

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';

-- Ni liberando la marca ni completando la duración después del guardado.
update public.set_logs set flagged = false, flag_reasons = '{}', duration_ms = 20000
 where id = '50000000-0000-0000-0000-000000000101';
select is((select flagged::text || ' ' || flag_reasons::text from public.set_logs
            where id = '50000000-0000-0000-0000-000000000101'),
  'true {missing_duration}', 'el cliente no libera ni quita missing_duration');

-- Cambiar el origen a manual tampoco: se conserva 'camera' y la marca.
update public.set_logs set source = 'manual'
 where id = '50000000-0000-0000-0000-000000000101';
select is((select source from public.set_logs where id = '50000000-0000-0000-0000-000000000101'),
  'camera', 'el cliente no cambia el origen para esquivar la regla');

reset role;
select * from finish();
rollback;
