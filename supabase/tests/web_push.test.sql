-- Tests de Web Push (issue #88, DEC-080): suscripciones y avisos por dueño, lo que el cliente
-- no puede escribir, validación del reemplazo, reclamo como mucho una vez y disparo del cron.
begin;
select plan(36);

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a1@test.local',
   '{"display_name":"Ana","birth_year":"1994","birth_month":"3","privacy_version":"privacy-2026-10-v1"}'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b1@test.local',
   '{"display_name":"Beto","birth_year":"1992","birth_month":"7","privacy_version":"privacy-2026-10-v1"}');

-- Claves con la forma real (65 y 16 bytes en base64url), sin valor criptográfico.
create temp table k (p256dh text, auth text) on commit drop;
insert into k values ('B' || repeat('A', 86), repeat('A', 22));
grant select on k to authenticated, anon;

-- Suscripción de B creada como superusuario, con un aviso pendiente.
insert into public.push_subscriptions (id, user_id, endpoint, p256dh, auth)
select '90000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1',
       'https://updates.push.services.mozilla.com/wpush/v2/beto', p256dh, auth from k;
insert into public.push_reminders (subscription_id, send_at, title, body, url)
values ('90000000-0000-0000-0000-0000000000b1', now() + interval '1 day', 'Hoy toca entrenar', 'Semana 1', '/#/rutinas');

-- ── Usuario A, como cliente ─────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

select lives_ok(
  $$select public.register_push_subscription('https://fcm.googleapis.com/fcm/send/ana', p256dh, auth, 'Chrome Android') from k$$,
  'A registra su suscripción');
select lives_ok(
  $$select public.register_push_subscription('https://fcm.googleapis.com/fcm/send/ana', p256dh, auth, 'Chrome Android 2') from k$$,
  'registrar de nuevo el mismo endpoint es idempotente');
select is((select count(*)::int from public.push_subscriptions), 1, 'A ve solo su suscripción');
select is((select user_id from public.push_subscriptions), '00000000-0000-0000-0000-0000000000a1'::uuid,
  'user_id lo pone la base');
select throws_ok(
  $$select public.register_push_subscription('https://evil.example.com/push', p256dh, auth) from k$$,
  '23514', null, 'un endpoint fuera de los servicios de push conocidos se rechaza');
select throws_ok(
  $$insert into public.push_subscriptions (endpoint, p256dh, auth) select 'https://fcm.googleapis.com/fcm/send/x', p256dh, auth from k$$,
  '42501', null, 'el cliente no inserta suscripciones directo');
select throws_ok(
  $$update public.push_subscriptions set user_agent = 'x'$$,
  '42501', null, 'el cliente no actualiza suscripciones');

-- Reemplazo de avisos
select is(
  public.replace_push_reminders('https://fcm.googleapis.com/fcm/send/ana', jsonb_build_array(
    jsonb_build_object('send_at', now() + interval '1 day', 'title', 'Hoy toca entrenar', 'body', 'Semana 1 · Pierna', 'url', '/#/rutinas?semana=1'),
    jsonb_build_object('send_at', now() + interval '3 days', 'title', 'Hoy toca entrenar', 'body', 'Semana 1 · Torso', 'url', '/#/rutinas?semana=1'))),
  2, 'A sube dos avisos');
select is(
  public.replace_push_reminders('https://fcm.googleapis.com/fcm/send/ana', jsonb_build_array(
    jsonb_build_object('send_at', now() + interval '3 days', 'title', 'Hoy toca entrenar', 'body', 'Semana 1 · Torso', 'url', '/#/rutinas?semana=1'))),
  1, 'el reemplazo devuelve los avisos nuevos');
select is((select count(*)::int from public.push_reminders), 1, 'el reemplazo borra los pendientes anteriores');
select is((select body from public.push_reminders), 'Semana 1 · Torso', 'quedan solo los avisos nuevos');
select throws_ok(
  $$insert into public.push_reminders (subscription_id, send_at, title, body, url)
    select id, now(), 't', 'b', '/#/' from public.push_subscriptions$$,
  '42501', null, 'el cliente no inserta avisos directo');
select throws_ok(
  $$update public.push_reminders set sent_at = now()$$,
  '42501', null, 'el cliente no puede fijar sent_at');
select throws_ok(
  $$delete from public.push_reminders$$,
  '42501', null, 'el cliente no borra avisos directo');
select throws_ok(
  $$select public.replace_push_reminders('https://fcm.googleapis.com/fcm/send/ana',
      (select jsonb_agg(jsonb_build_object('send_at', now() + make_interval(hours => i), 'title', 't', 'body', 'b', 'url', '/#/'))
         from generate_series(1, 31) i))$$,
  '22023', null, 'como mucho 30 avisos');
select throws_ok(
  $$select public.replace_push_reminders('https://fcm.googleapis.com/fcm/send/ana', jsonb_build_array(
      jsonb_build_object('send_at', now() + interval '20 days', 'title', 't', 'body', 'b', 'url', '/#/')))$$,
  '22023', null, 'un aviso a más de 15 días se rechaza');
select throws_ok(
  $$select public.replace_push_reminders('https://fcm.googleapis.com/fcm/send/ana', jsonb_build_array(
      jsonb_build_object('send_at', now() - interval '1 hour', 'title', 't', 'body', 'b', 'url', '/#/')))$$,
  '22023', null, 'un aviso en el pasado se rechaza');
select throws_ok(
  $$select public.replace_push_reminders('https://fcm.googleapis.com/fcm/send/ana', jsonb_build_array(
      jsonb_build_object('send_at', now() + interval '1 day', 'title', 't', 'body', 'b', 'url', 'https://evil.example.com')))$$,
  '23514', null, 'la url del aviso es relativa a la app');
select is((select count(*)::int from public.push_reminders), 1, 'un reemplazo rechazado no toca los avisos guardados');

-- Datos de B
select is((select count(*)::int from public.push_subscriptions where user_id = '00000000-0000-0000-0000-0000000000b1'), 0,
  'A no ve las suscripciones de B');
select is((select count(*)::int from public.push_reminders where subscription_id = '90000000-0000-0000-0000-0000000000b1'), 0,
  'A no ve los avisos de B');
select throws_ok(
  $$select public.replace_push_reminders('https://updates.push.services.mozilla.com/wpush/v2/beto', '[]')$$,
  '42501', null, 'A no reemplaza los avisos de la suscripción de B');
delete from public.push_subscriptions where id = '90000000-0000-0000-0000-0000000000b1';
select throws_ok(
  $$select * from public.claim_due_push_reminders(10)$$,
  '42501', null, 'el cliente no reclama avisos');

-- Tope de 10 suscripciones por cuenta
select public.register_push_subscription('https://fcm.googleapis.com/fcm/send/ana-' || i, p256dh, auth)
  from k, generate_series(1, 10) i;
select is((select count(*)::int from public.push_subscriptions), 10, 'como mucho 10 suscripciones por cuenta');
select is((select count(*)::int from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/ana'), 0,
  'sobra la registrada hace más tiempo');
select public.register_push_subscription('https://fcm.googleapis.com/fcm/send/ana', p256dh, auth) from k;

-- ── Otra cuenta en el mismo navegador ───────────────────────────────────────
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select public.register_push_subscription('https://fcm.googleapis.com/fcm/send/ana', p256dh, auth) from k;
select is((select count(*)::int from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/ana'), 1,
  'B toma el endpoint que estaba en la cuenta de A');

-- ── anon ────────────────────────────────────────────────────────────────────
set local role anon;
select throws_ok(
  $$select public.register_push_subscription('https://fcm.googleapis.com/fcm/send/anon', p256dh, auth) from k$$,
  '42501', null, 'anon no registra suscripciones');

-- ── Como superusuario: lo que pasó y el reclamo ─────────────────────────────
reset role;
select is((select count(*)::int from public.push_subscriptions where id = '90000000-0000-0000-0000-0000000000b1'), 1,
  'el borrado de A no tocó la suscripción de B');
select is((select user_id from public.push_subscriptions where endpoint = 'https://fcm.googleapis.com/fcm/send/ana'),
  '00000000-0000-0000-0000-0000000000b1'::uuid, 'el endpoint quedó en la cuenta de B, sin los avisos de A');

delete from public.push_reminders;
select is(private.dispatch_push_reminders(), null, 'el cron no llama a la función si no hay avisos vencidos');

insert into public.push_reminders (subscription_id, send_at, title, body, url) values
  ('90000000-0000-0000-0000-0000000000b1', now() - interval '1 minute', 'Hoy toca entrenar', 'Semana 2 · Pierna', '/#/rutinas?semana=2'),
  ('90000000-0000-0000-0000-0000000000b1', now() - interval '3 hours', 'Hoy toca entrenar', 'Viejo', '/#/rutinas'),
  ('90000000-0000-0000-0000-0000000000b1', now() + interval '1 hour', 'Hoy toca entrenar', 'Futuro', '/#/rutinas');

select is(private.dispatch_push_reminders(), null, 'sin URL ni secreto en Vault el cron no hace nada');
select vault.create_secret('http://127.0.0.1:9/functions/v1/send-reminders', 'send_reminders_url');
select vault.create_secret('secreto-de-prueba', 'send_reminders_secret');
select isnt(private.dispatch_push_reminders(), null, 'con avisos vencidos y Vault configurado, el cron llama a la función');

set local role service_role;
select is((select array_agg(body) from public.claim_due_push_reminders(10)), array['Semana 2 · Pierna'],
  'la función reclama solo lo vencido hace menos de 2 h');
select is((select count(*)::int from public.claim_due_push_reminders(10)), 0, 'un aviso se reclama como mucho una vez');
reset role;
select is((select count(*)::int from public.push_reminders where sent_at is null), 1,
  'lo viejo queda procesado sin enviar y lo futuro sigue pendiente');

delete from public.push_subscriptions where id = '90000000-0000-0000-0000-0000000000b1';
select is((select count(*)::int from public.push_reminders), 0, 'borrar la suscripción borra sus avisos');

select * from finish();
rollback;
