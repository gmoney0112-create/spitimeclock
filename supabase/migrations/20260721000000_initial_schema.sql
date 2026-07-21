-- Stars PI Time Clock & Shift Scheduling — initial schema + RLS
-- See CLAUDE.md §5 (schema) and §14 (what this migration implements).

-- ============================================================================
-- Extensions
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ============================================================================
-- Schemas
-- ============================================================================

-- Helper functions live outside `public` so PostgREST never exposes them
-- as callable RPCs; they're only used inside RLS policies and triggers.
create schema if not exists private;

-- ============================================================================
-- Enums
-- ============================================================================

create type public.employee_role as enum ('admin', 'office_manager', 'employee');
create type public.pay_type as enum ('hourly', 'salary');
create type public.employee_status as enum ('active', 'inactive');
create type public.punch_type as enum ('clock_in', 'clock_out', 'break_start', 'break_end');
create type public.punch_source as enum ('web_self', 'kiosk', 'manual_admin_entry');
create type public.timesheet_status as enum ('pending_review', 'approved', 'exported');
create type public.pay_period_status as enum ('open', 'closed', 'exported');
create type public.shift_status as enum ('open', 'claimed', 'filled', 'cancelled');
create type public.shift_claim_status as enum ('pending', 'approved', 'denied');

-- ============================================================================
-- Tables
-- ============================================================================

create table public.employees (
  id uuid primary key default extensions.gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  full_name text not null,
  email text not null unique,
  phone text,
  role public.employee_role not null default 'employee',
  pay_type public.pay_type not null default 'hourly',
  hourly_rate numeric(10, 2),
  pin_code text,
  status public.employee_status not null default 'active',
  hire_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.pay_periods (
  id uuid primary key default extensions.gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  status public.pay_period_status not null default 'open',
  constraint pay_periods_dates_check check (end_date > start_date)
);

create table public.time_punches (
  id uuid primary key default extensions.gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  punch_type public.punch_type not null,
  "timestamp" timestamptz not null default now(),
  source public.punch_source not null default 'web_self',
  notes text,
  created_at timestamptz not null default now()
);

create table public.punch_corrections (
  id uuid primary key default extensions.gen_random_uuid(),
  original_punch_id uuid references public.time_punches (id) on delete set null,
  employee_id uuid not null references public.employees (id) on delete cascade,
  corrected_timestamp timestamptz not null,
  reason text not null,
  edited_by uuid not null references public.employees (id),
  created_at timestamptz not null default now()
);

create table public.timesheets (
  id uuid primary key default extensions.gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  pay_period_id uuid not null references public.pay_periods (id) on delete cascade,
  regular_hours numeric(6, 2) not null default 0,
  overtime_hours numeric(6, 2) not null default 0,
  total_hours numeric(6, 2) not null default 0,
  status public.timesheet_status not null default 'pending_review',
  approved_by uuid references public.employees (id),
  approved_at timestamptz,
  unique (employee_id, pay_period_id)
);

create table public.shifts (
  id uuid primary key default extensions.gen_random_uuid(),
  title text not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  role_needed text,
  status public.shift_status not null default 'open',
  posted_by uuid not null references public.employees (id),
  created_at timestamptz not null default now(),
  constraint shifts_time_check check (end_time > start_time)
);

create table public.shift_claims (
  id uuid primary key default extensions.gen_random_uuid(),
  shift_id uuid not null references public.shifts (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  status public.shift_claim_status not null default 'pending',
  claimed_at timestamptz not null default now(),
  decided_by uuid references public.employees (id),
  decided_at timestamptz,
  unique (shift_id, employee_id)
);

-- Only one claim per shift may ever be approved — makes "first approval
-- wins" an atomic, database-enforced guarantee instead of an app-layer race.
create unique index shift_claims_one_approved_per_shift
  on public.shift_claims (shift_id)
  where status = 'approved';

create table public.audit_log (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_id uuid references public.employees (id),
  action text not null,
  target_table text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

create index time_punches_employee_timestamp_idx on public.time_punches (employee_id, "timestamp");
create index punch_corrections_employee_idx on public.punch_corrections (employee_id);
create index timesheets_employee_period_idx on public.timesheets (employee_id, pay_period_id);
create index shifts_date_status_idx on public.shifts (date, status);
create index shift_claims_shift_idx on public.shift_claims (shift_id);
create index shift_claims_employee_idx on public.shift_claims (employee_id);
create index audit_log_target_idx on public.audit_log (target_table, target_id);

-- ============================================================================
-- Helper functions (private schema — not exposed via PostgREST)
-- ============================================================================

create function private.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.employees where auth_user_id = auth.uid();
$$;

create function private.is_admin_or_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.employees
    where auth_user_id = auth.uid()
      and role in ('admin', 'office_manager')
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.current_employee_id() to authenticated;
grant execute on function private.is_admin_or_manager() to authenticated;

-- ============================================================================
-- Audit log trigger — logs system-critical actions server-side so the trail
-- can't be skipped by a client that forgets to write to audit_log itself.
-- ============================================================================

create function private.write_audit_log()
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

  elsif TG_TABLE_NAME = 'timesheets' and new.status = 'approved'
        and old.status is distinct from new.status then
    v_action := 'approved_timesheet';
    v_target_id := new.id;
    v_metadata := jsonb_build_object('employee_id', new.employee_id, 'pay_period_id', new.pay_period_id);

  elsif TG_TABLE_NAME = 'shifts' and TG_OP = 'INSERT' then
    v_action := 'posted_shift';
    v_target_id := new.id;
    v_metadata := jsonb_build_object('title', new.title, 'date', new.date);

  elsif TG_TABLE_NAME = 'shift_claims' and new.status in ('approved', 'denied')
        and old.status is distinct from new.status then
    v_action := 'decided_shift_claim_' || new.status;
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

create trigger punch_corrections_audit
  after insert on public.punch_corrections
  for each row execute function private.write_audit_log();

create trigger timesheets_audit
  after update on public.timesheets
  for each row execute function private.write_audit_log();

create trigger shifts_audit
  after insert on public.shifts
  for each row execute function private.write_audit_log();

create trigger shift_claims_audit
  after update on public.shift_claims
  for each row execute function private.write_audit_log();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.employees enable row level security;
alter table public.pay_periods enable row level security;
alter table public.time_punches enable row level security;
alter table public.punch_corrections enable row level security;
alter table public.timesheets enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_claims enable row level security;
alter table public.audit_log enable row level security;

-- employees ------------------------------------------------------------------
-- Row-level policies alone can't hide individual columns (hourly_rate) from
-- a self-select; see the `my_profile` view below for that.

create policy employees_select_self on public.employees
  for select using (auth_user_id = auth.uid());

create policy employees_select_admin on public.employees
  for select using (private.is_admin_or_manager());

create policy employees_insert_admin on public.employees
  for insert with check (private.is_admin_or_manager());

create policy employees_update_admin on public.employees
  for update using (private.is_admin_or_manager())
  with check (private.is_admin_or_manager());

-- pay_periods ------------------------------------------------------------------
-- Every employee needs to see period boundaries to read their own timesheet.

create policy pay_periods_select_all on public.pay_periods
  for select using (auth.uid() is not null);

create policy pay_periods_write_admin on public.pay_periods
  for all using (private.is_admin_or_manager())
  with check (private.is_admin_or_manager());

-- time_punches ------------------------------------------------------------------
-- Immutable ledger: no update/delete policy for anyone. Corrections go
-- through punch_corrections instead.

create policy time_punches_select_own on public.time_punches
  for select using (employee_id = private.current_employee_id());

create policy time_punches_select_admin on public.time_punches
  for select using (private.is_admin_or_manager());

create policy time_punches_insert_self on public.time_punches
  for insert with check (
    employee_id = private.current_employee_id()
    and source = 'web_self'
  );

create policy time_punches_insert_admin on public.time_punches
  for insert with check (
    private.is_admin_or_manager()
    and source = 'manual_admin_entry'
  );

-- punch_corrections ------------------------------------------------------------------
-- Immutable audit trail: no update/delete policy at all.

create policy punch_corrections_select_own on public.punch_corrections
  for select using (employee_id = private.current_employee_id());

create policy punch_corrections_select_admin on public.punch_corrections
  for select using (private.is_admin_or_manager());

create policy punch_corrections_insert_admin on public.punch_corrections
  for insert with check (
    private.is_admin_or_manager()
    and edited_by = private.current_employee_id()
  );

-- timesheets ------------------------------------------------------------------
-- Computed by a scheduled job (service role); admins can still adjust/approve
-- directly from the dashboard.

create policy timesheets_select_own on public.timesheets
  for select using (employee_id = private.current_employee_id());

create policy timesheets_select_admin on public.timesheets
  for select using (private.is_admin_or_manager());

create policy timesheets_write_admin on public.timesheets
  for all using (private.is_admin_or_manager())
  with check (private.is_admin_or_manager());

-- shifts ------------------------------------------------------------------
-- Every employee needs to browse open shifts.

create policy shifts_select_all on public.shifts
  for select using (auth.uid() is not null);

create policy shifts_write_admin on public.shifts
  for all using (private.is_admin_or_manager())
  with check (private.is_admin_or_manager());

-- shift_claims ------------------------------------------------------------------
-- Employees claim for themselves only; admins decide (approve/deny).

create policy shift_claims_select_own on public.shift_claims
  for select using (employee_id = private.current_employee_id());

create policy shift_claims_select_admin on public.shift_claims
  for select using (private.is_admin_or_manager());

create policy shift_claims_insert_self on public.shift_claims
  for insert with check (
    employee_id = private.current_employee_id()
    and status = 'pending'
  );

create policy shift_claims_decide_admin on public.shift_claims
  for update using (private.is_admin_or_manager())
  with check (private.is_admin_or_manager());

-- audit_log ------------------------------------------------------------------
-- Read-only for admins; writes happen exclusively via the security-definer
-- trigger above (no insert/update/delete policy for any client role).

create policy audit_log_select_admin on public.audit_log
  for select using (private.is_admin_or_manager());

-- ============================================================================
-- Self-service view: employee profile without sensitive pay columns
-- ============================================================================

create view public.my_profile
with (security_invoker = true) as
  select id, auth_user_id, full_name, email, phone, role, status, hire_date, created_at
  from public.employees
  where auth_user_id = auth.uid();

grant select on public.my_profile to authenticated;
