-- Wraps punch corrections/additions in transactional RPCs so the
-- "never a silent overwrite" rule (CLAUDE.md §5, §11) is enforced
-- server-side rather than relying on the client to make two writes.
--
-- p_local_timestamp is a plain `timestamp` (no offset) interpreted as
-- America/Chicago wall-clock time — the office's fixed timezone,
-- regardless of the admin's own browser timezone.

create function public.correct_punch(
  p_punch_id uuid,
  p_local_timestamp timestamp,
  p_reason text
)
returns public.punch_corrections
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee_id uuid;
  v_correction public.punch_corrections;
begin
  if not private.is_admin_or_manager() then
    raise exception 'not authorized';
  end if;

  select employee_id into v_employee_id from public.time_punches where id = p_punch_id;
  if not found then
    raise exception 'punch % not found', p_punch_id;
  end if;

  insert into public.punch_corrections (
    original_punch_id, employee_id, corrected_timestamp, reason, edited_by
  )
  values (
    p_punch_id,
    v_employee_id,
    p_local_timestamp at time zone 'America/Chicago',
    p_reason,
    private.current_employee_id()
  )
  returning * into v_correction;

  return v_correction;
end;
$$;

grant execute on function public.correct_punch(uuid, timestamp, text) to authenticated;

create function public.add_missing_punch(
  p_employee_id uuid,
  p_punch_type public.punch_type,
  p_local_timestamp timestamp,
  p_reason text
)
returns public.time_punches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_punch public.time_punches;
  v_ts timestamptz;
begin
  if not private.is_admin_or_manager() then
    raise exception 'not authorized';
  end if;

  v_ts := p_local_timestamp at time zone 'America/Chicago';

  insert into public.time_punches (employee_id, punch_type, "timestamp", source)
  values (p_employee_id, p_punch_type, v_ts, 'manual_admin_entry')
  returning * into v_punch;

  insert into public.punch_corrections (
    original_punch_id, employee_id, corrected_timestamp, reason, edited_by
  )
  values (v_punch.id, p_employee_id, v_ts, p_reason, private.current_employee_id());

  return v_punch;
end;
$$;

grant execute on function public.add_missing_punch(uuid, public.punch_type, timestamp, text) to authenticated;
