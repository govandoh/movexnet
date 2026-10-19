-- Puerta 18+ con mes y año de nacimiento (issue #60, revisión del PR #68, DEC-069).
--
-- Solo con el año, "cumple 18 este año" dejaba entrar a quien aún tiene 17. Con el mes la
-- regla es conservadora: sin el día, el cumpleaños puede caer el último día del mes, así que
-- se exige que hayan pasado 18 años y al menos un mes completo más desde el mes de
-- nacimiento (217 meses o más). Nacido en octubre de 2008: puede registrarse desde el
-- 1 de noviembre de 2026. La hora de referencia es la de Guatemala.
-- Misma regla en src/domain/auth.ts (`isAdultBirthMonth`).

alter table public.profiles
  add column birth_month smallint check (birth_month between 1 and 12);

create function private.is_adult_birth_month(birth_year integer, birth_month integer) returns boolean
language sql stable set search_path = '' as $$
  with now_gt as (select (now() at time zone 'America/Guatemala') as t)
  select birth_year is not null
     and birth_month between 1 and 12
     and birth_year >= extract(year from t)::int - 120
     and (extract(year from t)::int - birth_year) * 12 + (extract(month from t)::int - birth_month) >= 217
  from now_gt
$$;
revoke all on function private.is_adult_birth_month(integer, integer) from public, anon, authenticated;

-- Alta: ahora exige también el mes. Resto igual que en 20261019000000_cuentas.sql.
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta          jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name        text  := btrim(coalesce(meta ->> 'display_name', ''));
  v_birth_text  text  := meta ->> 'birth_year';
  v_month_text  text  := meta ->> 'birth_month';
  v_birth_year  integer;
  v_birth_month integer;
begin
  if char_length(v_name) not between 1 and 60 then
    raise exception 'registro rechazado: nombre inválido' using errcode = '22023';
  end if;
  if v_birth_text is null or v_birth_text !~ '^[0-9]{4}$'
     or v_month_text is null or v_month_text !~ '^[0-9]{1,2}$' then
    raise exception 'registro rechazado: fecha de nacimiento inválida' using errcode = '22023';
  end if;
  v_birth_year := v_birth_text::integer;
  v_birth_month := v_month_text::integer;
  if not private.is_adult_birth_month(v_birth_year, v_birth_month) then
    raise exception 'registro rechazado: edad mínima 18 años' using errcode = '22023';
  end if;
  if (meta ->> 'privacy_version') is distinct from private.current_privacy_version() then
    raise exception 'registro rechazado: aviso de privacidad no aceptado' using errcode = '22023';
  end if;

  insert into public.profiles (user_id, display_name, birth_year, birth_month, privacy_version, privacy_accepted_at)
  values (new.id, v_name, v_birth_year, v_birth_month, private.current_privacy_version(), now());
  return new;
end $$;

-- Después del alta no se puede declarar una fecha que deje a la persona por debajo de 18.
create or replace function private.guard_profile_birth_year() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_adult_birth_month(new.birth_year, new.birth_month) then
    raise exception 'la fecha de nacimiento debe corresponder a una persona mayor de 18 años'
      using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger profiles_guard_birth_year on public.profiles;
create trigger profiles_guard_birth_year
  before update of birth_year, birth_month on public.profiles
  for each row execute function private.guard_profile_birth_year();

-- La regla solo por año ya no la usa nadie.
drop function private.is_adult_birth_year(integer);

grant update (birth_month) on public.profiles to authenticated;
