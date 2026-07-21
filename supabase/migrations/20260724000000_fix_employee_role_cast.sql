-- Fixes "column \"role\" is of type public.employee_role but expression is
-- of type text" on every signup. A `case when ... then 'admin' else
-- 'employee' end` with only string-literal branches resolves to `text`
-- (not `unknown`, unlike a single bare literal), so it needs an explicit
-- cast to satisfy the enum column.

create or replace function private.handle_new_auth_user()
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
    (case when v_employee_count = 0 then 'admin' else 'employee' end)::public.employee_role
  );

  return new;
end;
$$;
