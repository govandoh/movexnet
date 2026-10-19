-- Tests de la migración de cuentas (issue #60, DEC-069): alta con puerta 18+ y aviso de
-- privacidad impuestos en el servidor, y campos del perfil que el cliente no puede tocar.
begin;
select plan(20);

-- Inserta un usuario como lo haría Auth en el registro. El rol de los tests no puede asumir
-- supabase_auth_admin, así que el camino real (Auth sin privilegios sobre public.profiles)
-- se prueba aparte con POST /auth/v1/signup contra `pnpm db:start` (ver el PR de #60).
create function pg_temp.sign_up(uid uuid, meta jsonb) returns void language sql as $$
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          uid::text || '@test.local', meta)
$$;

-- ── Alta ────────────────────────────────────────────────────────────────────

select lives_ok(
  $$select pg_temp.sign_up('00000000-0000-0000-0000-0000000000c1',
    '{"display_name":"  Carla ","birth_year":"1998","privacy_version":"privacy-2026-10-v1"}')$$,
  'un adulto que acepta el aviso vigente se registra');

select is(
  (select display_name || '|' || birth_year || '|' || privacy_version
     from public.profiles where user_id = '00000000-0000-0000-0000-0000000000c1'),
  'Carla|1998|privacy-2026-10-v1', 'el alta crea el perfil con nombre recortado, año y versión');
select ok(
  (select privacy_accepted_at between now() - interval '1 minute' and now()
     from public.profiles where user_id = '00000000-0000-0000-0000-0000000000c1'),
  'la fecha de aceptación la pone el servidor');

select throws_ok(
  format($$select pg_temp.sign_up('00000000-0000-0000-0000-0000000000c2',
    '{"display_name":"Menor","birth_year":"%s","privacy_version":"privacy-2026-10-v1"}')$$,
    extract(year from now())::int - 17),
  '22023', null, 'menor de 18 años: el registro se rechaza');
select is(
  (select count(*)::int from auth.users where id = '00000000-0000-0000-0000-0000000000c2'),
  0, 'el rechazo no deja la cuenta creada');

select lives_ok(
  format($$select pg_temp.sign_up('00000000-0000-0000-0000-0000000000c3',
    '{"display_name":"Justo","birth_year":"%s","privacy_version":"privacy-2026-10-v1"}')$$,
    extract(year from now())::int - 18),
  'quien cumple 18 este año se registra (regla por año de calendario)');

select throws_ok(
  $$select pg_temp.sign_up('00000000-0000-0000-0000-0000000000c4',
    '{"display_name":"Sin año","privacy_version":"privacy-2026-10-v1"}')$$,
  '22023', null, 'sin año de nacimiento: rechazado');
select throws_ok(
  $$select pg_temp.sign_up('00000000-0000-0000-0000-0000000000c5',
    '{"display_name":"Raro","birth_year":"19x5","privacy_version":"privacy-2026-10-v1"}')$$,
  '22023', null, 'año de nacimiento no numérico: rechazado');
select throws_ok(
  $$select pg_temp.sign_up('00000000-0000-0000-0000-0000000000c6',
    '{"display_name":"Viejo","birth_year":"1850","privacy_version":"privacy-2026-10-v1"}')$$,
  '22023', null, 'año de nacimiento absurdo: rechazado');
select throws_ok(
  $$select pg_temp.sign_up('00000000-0000-0000-0000-0000000000c7',
    '{"display_name":"Sin aviso","birth_year":"1990"}')$$,
  '22023', null, 'sin aceptar el aviso: rechazado');
select throws_ok(
  $$select pg_temp.sign_up('00000000-0000-0000-0000-0000000000c8',
    '{"display_name":"Viejo aviso","birth_year":"1990","privacy_version":"privacy-2020-01-v1"}')$$,
  '22023', null, 'con una versión del aviso que no es la vigente: rechazado');
select throws_ok(
  $$select pg_temp.sign_up('00000000-0000-0000-0000-0000000000c9',
    '{"display_name":"   ","birth_year":"1990","privacy_version":"privacy-2026-10-v1"}')$$,
  '22023', null, 'nombre vacío: rechazado');

-- ── El cliente sobre su propio perfil ───────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';

select lives_ok(
  $$update public.profiles set display_name = 'Carla R.', weight_kg = 61.5$$,
  'edita los campos de su perfil');
select throws_ok(
  $$update public.profiles set privacy_version = 'privacy-2099-01-v9'$$,
  '42501', null, 'no puede cambiar la versión del aviso aceptada');
select throws_ok(
  $$update public.profiles set privacy_accepted_at = now() - interval '5 years'$$,
  '42501', null, 'no puede falsificar la fecha de aceptación');
select throws_ok(
  $$update public.profiles set user_id = '00000000-0000-0000-0000-0000000000c3'$$,
  '42501', null, 'no puede reasignar su perfil a otro usuario');
select throws_ok(
  format($$update public.profiles set birth_year = %s$$, extract(year from now())::int - 10),
  '23514', null, 'no puede declarar después una edad menor de 18');
select throws_ok(
  $$insert into public.profiles (user_id, display_name, birth_year, privacy_version)
    values ('00000000-0000-0000-0000-0000000000c1', 'Otra', 1990, 'privacy-2026-10-v1')$$,
  '42501', null, 'no puede crear perfiles: solo el alta los crea');
select throws_ok(
  $$delete from public.profiles$$,
  '42501', null, 'no puede borrar su perfil (borrar la cuenta va por Edge Function)');
select throws_ok(
  $$select private.current_privacy_version()$$,
  '42501', null, 'no puede llamar a las funciones de private');

select * from finish();
rollback;
