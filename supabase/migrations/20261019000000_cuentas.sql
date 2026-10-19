-- Cuentas con Supabase Auth (issue #60, DEC-069). Aviso de privacidad y regla 18+: DEC-067.
--
-- Modelo de amenazas: el cliente tiene la clave publicable y puede llamar a la API de Auth y
-- a PostgREST sin pasar por la UI. Por eso la edad y la aceptación del aviso se imponen aquí:
-- 1. El perfil solo lo crea el trigger de alta sobre auth.users, que rechaza el registro
--    (y con él la cuenta, en la misma transacción) si faltan los datos o no cumplen.
-- 2. El cliente no puede insertar ni borrar perfiles, ni tocar user_id, privacy_* o fechas.
-- 3. Después del alta no se puede declarar una edad menor de 18.
-- raw_user_meta_data lo escribe el usuario (también con auth.updateUser): solo se lee aquí,
-- en el alta, y nunca debe usarse para autorizar nada.

-- ── Columnas del aviso de privacidad ────────────────────────────────────────

alter table public.profiles
  add column privacy_version     text check (privacy_version ~ '^privacy-[0-9]{4}-[0-9]{2}-v[0-9]+$'),
  add column privacy_accepted_at timestamptz;

-- Versión vigente del aviso (DEC-067). Cambiarla es una migración nueva y pide re-aceptación.
create function private.current_privacy_version() returns text
language sql immutable set search_path = '' as $$ select 'privacy-2026-10-v1' $$;

-- Edad mínima declarada con el año de nacimiento: 18 años de diferencia de calendario
-- (DEC-067). Es declarativa; un año sin mes no permite más precisión. El tope inferior
-- descarta años absurdos. Misma regla en src/domain/auth.ts (`isAdultBirthYear`).
create function private.is_adult_birth_year(birth_year integer) returns boolean
language sql stable set search_path = '' as $$
  select birth_year is not null
     and birth_year >= extract(year from now())::int - 120
     and extract(year from now())::int - birth_year >= 18
$$;

-- ── Alta: crea el perfil o rechaza la cuenta ────────────────────────────────
-- SECURITY DEFINER porque el rol de Auth (supabase_auth_admin) no tiene privilegios sobre
-- public.profiles. search_path vacío y nombres calificados para que no se pueda secuestrar
-- la resolución de objetos. Los mensajes no llegan al cliente (Auth responde un error
-- genérico); la UI valida antes para dar un mensaje útil.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta         jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name       text  := btrim(coalesce(meta ->> 'display_name', ''));
  v_birth_text text  := meta ->> 'birth_year';
  v_birth_year integer;
begin
  if char_length(v_name) not between 1 and 60 then
    raise exception 'registro rechazado: nombre inválido' using errcode = '22023';
  end if;
  if v_birth_text is null or v_birth_text !~ '^[0-9]{4}$' then
    raise exception 'registro rechazado: año de nacimiento inválido' using errcode = '22023';
  end if;
  v_birth_year := v_birth_text::integer;
  if not private.is_adult_birth_year(v_birth_year) then
    raise exception 'registro rechazado: edad mínima 18 años' using errcode = '22023';
  end if;
  if (meta ->> 'privacy_version') is distinct from private.current_privacy_version() then
    raise exception 'registro rechazado: aviso de privacidad no aceptado' using errcode = '22023';
  end if;

  -- La fecha de aceptación la pone el servidor, nunca el cliente.
  insert into public.profiles (user_id, display_name, birth_year, privacy_version, privacy_accepted_at)
  values (new.id, v_name, v_birth_year, private.current_privacy_version(), now());
  return new;
end $$;

revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.current_privacy_version() from public, anon, authenticated;
revoke all on function private.is_adult_birth_year(integer) from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ── Edad después del alta ───────────────────────────────────────────────────
-- SECURITY DEFINER para llamar a private.is_adult_birth_year sin dar al cliente USAGE sobre
-- el esquema private (0100 se lo quita); la función solo lee NEW.
create function private.guard_profile_birth_year() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_adult_birth_year(new.birth_year) then
    raise exception 'el año de nacimiento debe corresponder a una persona mayor de 18 años'
      using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.guard_profile_birth_year() from public, anon, authenticated;

create trigger profiles_guard_birth_year
  before update of birth_year on public.profiles
  for each row execute function private.guard_profile_birth_year();

-- ── Privilegios del cliente sobre profiles ──────────────────────────────────
-- La política profiles_owner es FOR ALL; los privilegios recortan lo que puede hacer:
-- leer su fila y actualizar solo los campos editables. Sin INSERT (lo hace el alta) ni
-- DELETE (borrar la cuenta es una Edge Function con service_role, fuera de #60).
revoke insert, update, delete on public.profiles from authenticated;
grant update (
  display_name, birth_year, height_cm, weight_kg, experience_level, goal, training_location,
  equipment, days_per_week, session_minutes, program_type, preferred_camera, public_profile
) on public.profiles to authenticated;
