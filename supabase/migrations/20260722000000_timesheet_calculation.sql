-- Timesheet calculation: rounds punches, pairs clock_in/clock_out, splits
-- regular vs. overtime hours per FLSA workweek, and upserts into
-- `timesheets`. Callable by admin/office_manager via RPC
-- (supabase.rpc('calculate_timesheets', { p_pay_period_id })).
--
-- Hardcoded per CLAUDE.md's one-week sprint scope ("no configurability
-- yet"): nearest-15-minute rounding, America/Chicago business timezone,
-- Monday-start workweek, 40hrs/week FLSA overtime threshold (Texas has no
-- daily OT rule). Revisit if any of these need to become configurable.

create function private.round_to_nearest_15(ts timestamptz)
returns timestamptz
language sql
immutable
as $$
  select to_timestamp(round(extract(epoch from ts) / 900) * 900);
$$;

create function public.calculate_timesheets(p_pay_period_id uuid)
returns setof public.timesheets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz constant text := 'America/Chicago';
  v_period public.pay_periods;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_employee record;
  v_punch record;
  v_open_in timestamptz;
  v_week_key text;
  v_week_totals jsonb;
  v_minutes numeric;
  v_regular numeric;
  v_overtime numeric;
  v_week_hours numeric;
  v_week record;
begin
  if not private.is_admin_or_manager() then
    raise exception 'not authorized';
  end if;

  select * into v_period from public.pay_periods where id = p_pay_period_id;
  if not found then
    raise exception 'pay period % not found', p_pay_period_id;
  end if;

  v_period_start := v_period.start_date::timestamp at time zone v_tz;
  v_period_end := (v_period.end_date + 1)::timestamp at time zone v_tz;

  for v_employee in
    select id, pay_type from public.employees where status = 'active'
  loop
    v_week_totals := '{}'::jsonb;
    v_open_in := null;

    for v_punch in
      select
        tp.punch_type,
        private.round_to_nearest_15(coalesce(
          (select pc.corrected_timestamp
           from public.punch_corrections pc
           where pc.original_punch_id = tp.id
           order by pc.created_at desc
           limit 1),
          tp.timestamp
        )) as effective_ts
      from public.time_punches tp
      where tp.employee_id = v_employee.id
        and tp.punch_type in ('clock_in', 'clock_out')
        and tp.timestamp >= v_period_start
        and tp.timestamp < v_period_end
      order by tp.timestamp
    loop
      if v_punch.punch_type = 'clock_in' then
        -- A second clock_in before a clock_out replaces the open one; the
        -- abandoned clock_in is an unpaired punch surfaced by the
        -- admin's missing-punch view, not silently counted here.
        v_open_in := v_punch.effective_ts;

      elsif v_punch.punch_type = 'clock_out' and v_open_in is not null then
        v_week_key := to_char(date_trunc('week', v_open_in at time zone v_tz), 'YYYY-MM-DD');
        v_minutes := extract(epoch from (v_punch.effective_ts - v_open_in)) / 60;
        v_week_totals := jsonb_set(
          v_week_totals,
          array[v_week_key],
          to_jsonb(coalesce((v_week_totals ->> v_week_key)::numeric, 0) + v_minutes)
        );
        v_open_in := null;
      end if;
    end loop;

    v_regular := 0;
    v_overtime := 0;

    for v_week in select key, value::numeric as minutes from jsonb_each_text(v_week_totals) loop
      v_week_hours := v_week.minutes / 60.0;
      if v_employee.pay_type = 'hourly' then
        v_regular := v_regular + least(v_week_hours, 40);
        v_overtime := v_overtime + greatest(v_week_hours - 40, 0);
      else
        -- Salaried/exempt staff: track hours worked, skip OT split.
        v_regular := v_regular + v_week_hours;
      end if;
    end loop;

    insert into public.timesheets (
      employee_id, pay_period_id, regular_hours, overtime_hours, total_hours, status
    )
    values (
      v_employee.id, p_pay_period_id, round(v_regular, 2), round(v_overtime, 2),
      round(v_regular + v_overtime, 2), 'pending_review'
    )
    on conflict (employee_id, pay_period_id) do update
      set regular_hours = excluded.regular_hours,
          overtime_hours = excluded.overtime_hours,
          total_hours = excluded.total_hours
      where public.timesheets.status = 'pending_review';
  end loop;

  return query select * from public.timesheets where pay_period_id = p_pay_period_id;
end;
$$;

grant execute on function public.calculate_timesheets(uuid) to authenticated;

-- Flags clock_ins with no matching clock_out (forgotten punch, not counted
-- in calculate_timesheets above) so admin review can catch it instead of
-- letting it silently drop hours. A clock_in is "missing" when the very
-- next punch for that employee isn't a clock_out — covers the common
-- one-shift-per-day case; it won't catch every multi-shift edge case.

create function public.list_missing_punches(p_pay_period_id uuid)
returns table (
  employee_id uuid,
  full_name text,
  punch_id uuid,
  punch_timestamp timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin_or_manager() then
    raise exception 'not authorized';
  end if;

  return query
  with period as (
    select
      start_date::timestamp at time zone 'America/Chicago' as period_start,
      (end_date + 1)::timestamp at time zone 'America/Chicago' as period_end
    from public.pay_periods
    where id = p_pay_period_id
  ),
  punches as (
    select
      tp.id,
      tp.employee_id,
      tp.punch_type,
      tp.timestamp,
      lead(tp.punch_type) over (partition by tp.employee_id order by tp.timestamp) as next_type
    from public.time_punches tp, period
    where tp.punch_type in ('clock_in', 'clock_out')
      and tp.timestamp >= period.period_start
      and tp.timestamp < period.period_end
  )
  select p.employee_id, e.full_name, p.id, p.timestamp
  from punches p
  join public.employees e on e.id = p.employee_id
  where p.punch_type = 'clock_in'
    and p.next_type is distinct from 'clock_out'
  order by p.timestamp;
end;
$$;

grant execute on function public.list_missing_punches(uuid) to authenticated;
