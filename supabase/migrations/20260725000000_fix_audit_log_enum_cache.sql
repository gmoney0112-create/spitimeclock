-- Fixes "invalid input value for enum public.shift_status: 'approved'" on
-- plain shift inserts. write_audit_log() is one trigger function shared
-- across four tables (punch_corrections, timesheets, shifts, shift_claims),
-- so `new` is a generic `record` whose underlying row type changes per
-- call. Comparing `new.status = 'approved'` forces Postgres to coerce the
-- literal to *some* enum type, and that coercion can get bound to the
-- wrong table's status enum across calls. Casting `new.status` to text
-- before comparing avoids enum coercion entirely.

create or replace function private.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.current_employee_id();
  v_action text;
  v_target_id uuid;
  v_metadata jsonb;
begin
  if TG_TABLE_NAME = 'punch_corrections' then
    v_action := 'corrected_punch';
    v_target_id := new.id;
    v_metadata := jsonb_build_object('employee_id', new.employee_id, 'reason', new.reason);

  elsif TG_TABLE_NAME = 'timesheets' and new.status::text = 'approved'
        and old.status is distinct from new.status then
    v_action := 'approved_timesheet';
    v_target_id := new.id;
    v_metadata := jsonb_build_object('employee_id', new.employee_id, 'pay_period_id', new.pay_period_id);

  elsif TG_TABLE_NAME = 'shifts' and TG_OP = 'INSERT' then
    v_action := 'posted_shift';
    v_target_id := new.id;
    v_metadata := jsonb_build_object('title', new.title, 'date', new.date);

  elsif TG_TABLE_NAME = 'shift_claims' and new.status::text in ('approved', 'denied')
        and old.status is distinct from new.status then
    v_action := 'decided_shift_claim_' || new.status::text;
    v_target_id := new.id;
    v_metadata := jsonb_build_object('shift_id', new.shift_id, 'employee_id', new.employee_id);

  else
    return new;
  end if;

  insert into public.audit_log (actor_id, action, target_table, target_id, metadata)
  values (v_actor, v_action, TG_TABLE_NAME, v_target_id, v_metadata);

  return new;
end;
$$;
