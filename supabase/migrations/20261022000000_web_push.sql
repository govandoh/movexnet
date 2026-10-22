-- Recordatorios con la app cerrada por Web Push (issue #88, DEC-080).
--
-- El cliente calcula los avisos de los próximos 14 días con el dominio (`reminderTimes`) y
-- los sube ya con hora absoluta, por suscripción (cada navegador tiene su hora). Cada 5
-- minutos pg_cron llama a la Edge Function `send-reminders` solo si hay avisos vencidos; la
-- función los reclama (como mucho una vez), los cifra y los envía al servicio de push.
-- El cliente no escribe directo en ninguna de las dos tablas: todo pasa por las funciones
-- de abajo, que validan dueño, cantidad y ventana.

create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault;

-- ── Suscripciones ───────────────────────────────────────────────────────────
-- Una por navegador. El endpoint es una URL con capacidad: quien la tiene puede enviar a ese
-- navegador. Solo se aceptan servicios de push conocidos (FCM, Mozilla, Windows, Apple) para
-- que la función nunca haga POST a una URL arbitraria; la misma lista está en
-- supabase/functions/send-reminders/webpush.ts.
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint   text not null unique
             check (char_length(endpoint) <= 1024 and endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com|web\.push\.apple\.com)/'),
  -- Clave pública P-256 (65 bytes) y secreto de autenticación (16 bytes), en base64url.
  p256dh     text not null check (p256dh ~ '^[A-Za-z0-9_-]{86,88}=*$'),
  auth       text not null check (auth ~ '^[A-Za-z0-9_-]{21,24}=*$'),
  user_agent text check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  -- Último registro desde la app: decide qué suscripciones sobran pasado el tope por cuenta.
  updated_at timestamptz not null default now()
);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;
-- La Edge Function borra las suscripciones vencidas (404 o 410 del servicio de push).
grant select, delete on public.push_subscriptions to service_role;

create policy push_subscriptions_owner_select on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy push_subscriptions_owner_delete on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

-- ── Avisos ──────────────────────────────────────────────────────────────────
-- `sent_at` = procesado: enviado, saltado por viejo o rechazado por el servicio de push.
-- El texto es solo el día del programa, sin métricas ni datos de salud (DEC-080 §8).
create table public.push_reminders (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.push_subscriptions (id) on delete cascade,
  send_at         timestamptz not null,
  title           text not null check (char_length(title) between 1 and 80),
  body            text not null check (char_length(body) <= 160),
  url             text not null check (char_length(url) <= 200 and url ~ '^/#/'),
  sent_at         timestamptz
);
create index push_reminders_due_idx on public.push_reminders (send_at) where sent_at is null;
create index push_reminders_subscription_id_idx on public.push_reminders (subscription_id);

alter table public.push_reminders enable row level security;
revoke all on public.push_reminders from anon, authenticated;
grant select on public.push_reminders to authenticated;

create policy push_reminders_owner_select on public.push_reminders
  for select to authenticated
  using (exists (
    select 1 from public.push_subscriptions s
     where s.id = subscription_id and s.user_id = (select auth.uid())
  ));

-- ── Registro de la suscripción (cliente) ────────────────────────────────────
-- Idempotente: la app lo llama al activar y en cada apertura, así un endpoint renovado por
-- el navegador queda guardado. Si el endpoint estaba en otra cuenta (otra persona entró en
-- el mismo navegador sin cerrar sesión), esa fila y sus avisos se borran: tener el endpoint
-- prueba que es ese navegador. Tope de 10 por cuenta; sobran las registradas hace más tiempo.
create function public.register_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'sin sesión' using errcode = '42501';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id <> v_uid;
  -- clock_timestamp y no now(): varios registros en una transacción quedan ordenados.
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, updated_at)
  values (v_uid, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300), clock_timestamp())
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, updated_at = excluded.updated_at
  returning id into v_id;
  delete from public.push_subscriptions
   where id in (
     select id from public.push_subscriptions
      where user_id = v_uid
      order by updated_at desc, id
     offset 10
   );
  return v_id;
end $$;

revoke all on function public.register_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;

-- ── Reemplazo de los avisos (cliente) ───────────────────────────────────────
-- En una transacción: borra los pendientes de la suscripción y pone los nuevos. Así nunca
-- hay un momento sin avisos ni avisos duplicados. `p_items` es un arreglo de
-- {send_at, title, body, url}; un arreglo vacío deja la suscripción sin avisos.
-- Ventana: de 5 min atrás (latencia de red) a 15 días (el cliente sube 14).
create function public.replace_push_reminders(p_endpoint text, p_items jsonb)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_sub   uuid;
  v_count integer;
begin
  select id into v_sub from public.push_subscriptions
   where endpoint = p_endpoint and user_id = auth.uid();
  if v_sub is null then
    raise exception 'suscripción desconocida' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 30 then
    raise exception 'se esperan como mucho 30 avisos' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) e
     where (e ->> 'send_at') is null
        or (e ->> 'send_at')::timestamptz < now() - interval '5 minutes'
        or (e ->> 'send_at')::timestamptz > now() + interval '15 days'
  ) then
    raise exception 'aviso fuera de la ventana de 15 días' using errcode = '22023';
  end if;

  delete from public.push_reminders where subscription_id = v_sub and sent_at is null;
  insert into public.push_reminders (subscription_id, send_at, title, body, url)
  select v_sub, (e ->> 'send_at')::timestamptz, e ->> 'title', e ->> 'body', e ->> 'url'
    from jsonb_array_elements(p_items) e;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function public.replace_push_reminders(text, jsonb) from public, anon;
grant execute on function public.replace_push_reminders(text, jsonb) to authenticated;

-- ── Reclamo de los vencidos (solo la Edge Function) ─────────────────────────
-- Marca `sent_at` antes de enviar, con `skip locked`: dos ejecuciones a la vez no mandan el
-- mismo aviso (como mucho una vez, DEC-080 §3). Lo vencido hace más de 2 h se marca sin
-- devolverlo: si el cron estuvo caído, no llega un "hoy toca" de madrugada.
create function public.claim_due_push_reminders(p_limit integer default 200)
returns table (
  reminder_id uuid, subscription_id uuid, endpoint text, p256dh text, auth text,
  title text, body text, url text
)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  update public.push_reminders set sent_at = now()
   where sent_at is null and send_at < now() - interval '2 hours';
  return query
  with due as (
    select r.id from public.push_reminders r
     where r.sent_at is null and r.send_at <= now()
     order by r.send_at
     limit least(greatest(coalesce(p_limit, 200), 1), 500)
     for update skip locked
  )
  update public.push_reminders r set sent_at = now()
    from due, public.push_subscriptions s
   where r.id = due.id and s.id = r.subscription_id
  returning r.id, s.id, s.endpoint, s.p256dh, s.auth, r.title, r.body, r.url;
end $$;

revoke all on function public.claim_due_push_reminders(integer) from public, anon, authenticated;
grant execute on function public.claim_due_push_reminders(integer) to service_role;

-- ── Disparo cada 5 minutos ──────────────────────────────────────────────────
-- Solo llama a la función si hay algo vencido: las invocaciones quedan muy por debajo del
-- cupo gratis (DEC-080 §9). La URL y el secreto viven en Vault y se cargan al desplegar
-- (descripción del PR #88); sin ellos no hace nada. Aquí no va ningún secreto.
create function private.dispatch_push_reminders() returns bigint
language plpgsql set search_path = '' as $$
declare
  v_url    text;
  v_secret text;
begin
  delete from public.push_reminders where sent_at < now() - interval '7 days';
  if not exists (
    select 1 from public.push_reminders where sent_at is null and send_at <= now()
  ) then
    return null;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'send_reminders_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'send_reminders_secret';
  if v_url is null or v_secret is null then
    return null;
  end if;
  return net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    timeout_milliseconds := 30000
  );
end $$;

revoke all on function private.dispatch_push_reminders() from public, anon, authenticated;

select cron.schedule(
  'send-push-reminders',
  '*/5 * * * *',
  $$select private.dispatch_push_reminders()$$
);
