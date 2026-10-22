-- Sincronización del historial, el perfil y el programa con la nube (issue #87, DEC-079).
--
-- La app guarda todo primero en el dispositivo y lo sube con una cola offline. Los ids los
-- asigna el cliente, así que reintentar no duplica. Reglas de conflicto (DEC-079):
-- * Sesiones, series y métricas solo se insertan: una serie es inmutable.
-- * Rutinas y objetivos: gana la última escritura según `updated_at`, que fija el cliente
--   con la hora del cambio. Una escritura más vieja que la guardada se ignora.
-- * Perfil: lo pendiente en el dispositivo gana; sin pendientes, manda la nube.

-- ── user_id lo pone la base ─────────────────────────────────────────────────
-- El cliente deja de enviarlo; las políticas siguen exigiendo user_id = auth.uid().

alter table public.workout_sessions alter column user_id set default auth.uid();
alter table public.set_logs         alter column user_id set default auth.uid();
alter table public.metrics          alter column user_id set default auth.uid();
alter table public.goals            alter column user_id set default auth.uid();

-- ── Privilegios por columna ─────────────────────────────────────────────────
-- Series: el cliente no puede ni intentar fijar las marcas anti-trampa al insertar (antes el
-- trigger las sobrescribía en silencio). UPDATE se mantiene como estaba: DEC-074 ya impide
-- liberar marcas o cambiar el origen, y la app no actualiza series.
revoke insert on public.set_logs from authenticated;
grant insert (
  id, user_id, session_id, exercise_id, method, method_params, load_kg, rpe, reps, started_at,
  source, duration_ms
) on public.set_logs to authenticated;

-- Sesiones: el inicio no se mueve después de creada (moverlo esquivaría el solapamiento de
-- DEC-074); solo se cierra.
revoke update on public.workout_sessions from authenticated;
grant update (ended_at) on public.workout_sessions to authenticated;

-- Métricas: inmutables, como la serie a la que pertenecen.
revoke update on public.metrics from authenticated;

-- ── Programa en el perfil ───────────────────────────────────────────────────
-- Inicio del programa generado por el cuestionario; null = no hay cuestionario. Las
-- respuestas ya tienen columnas (goal, experience_level, training_location, equipment,
-- days_per_week, session_minutes, program_type).
alter table public.profiles add column program_started_at timestamptz;
grant update (program_started_at) on public.profiles to authenticated;

-- ── Última escritura gana ───────────────────────────────────────────────────
-- BEFORE UPDATE: si llega una versión más vieja que la guardada (otro dispositivo escribió
-- después), se descarta la fila sin error. Igual `updated_at` se aplica: reintentar la misma
-- escritura es idempotente. También vale para el `upsert` (ON CONFLICT DO UPDATE).
-- Un reloj adelantado bloquearía la fila para siempre: la hora del cliente se acota a un día
-- después de la del servidor, también al insertar.
create function private.keep_newest() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := least(new.updated_at, now() + interval '1 day');
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  return new;
end $$;
revoke all on function private.keep_newest() from public, anon, authenticated;

-- ── Objetivos ───────────────────────────────────────────────────────────────
-- `metric_name` guarda el tipo de objetivo de la app (`GoalKind` en src/domain/progress.ts).
alter table public.goals add column updated_at timestamptz not null default now();

create trigger goals_keep_newest before insert or update on public.goals
  for each row execute function private.keep_newest();

-- ── Rutinas ─────────────────────────────────────────────────────────────────
-- Los días van como JSON: su forma la valida el cliente al leer (`parseRoutines`, DEC-052),
-- igual que lo leído de localStorage. Aquí solo se acota el tipo y el tamaño.
create table public.routines (
  id         uuid primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) <= 40),
  -- Solo una activa por usuario; lo resuelve el cliente al fusionar, no una restricción
  -- única: activar una y desactivar otra llegan como dos escrituras en cualquier orden.
  active     boolean not null default false,
  days       jsonb not null default '[]'
             check (jsonb_typeof(days) = 'array' and octet_length(days::text) <= 65536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index routines_user_id_idx on public.routines (user_id);

alter table public.routines enable row level security;
revoke all on public.routines from anon;
revoke truncate, trigger, references on public.routines from authenticated;

create policy routines_owner on public.routines
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create trigger routines_keep_newest before insert or update on public.routines
  for each row execute function private.keep_newest();
