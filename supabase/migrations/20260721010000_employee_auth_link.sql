-- Links Supabase Auth users to public.employees automatically.
--
-- Two cases, in order:
--   1. An admin already created an `employees` row for this person (by
--      email) before they ever signed in — link auth_user_id to it.
--   2. No matching row exists — provision one. The very first person to
--      ever sign in becomes `admin` (there's no employee-management UI
--      yet to seed an admin any other way); everyone after that lands as
--      a plain `employee`, matching admin-adds-people-first in practice.

create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee_count bigint;
begin
  update public.employees
  set auth_user_id = new.id
  where lower(email) = lower(new.email)
    and auth_user_id is null;

  if found then
    return new;
  end if;

  select count(*) into v_employee_count from public.employees;

  insert into public.employees (auth_user_id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    case when v_employee_count = 0 then 'admin' else 'employee' end
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();
