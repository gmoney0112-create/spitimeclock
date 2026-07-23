-- Weekly Schedule: a second, parallel way shifts get filled, alongside the
-- existing open-marketplace claim workflow. schedule_type distinguishes the
-- two -- 'marketplace' is the existing post/claim/approve flow (unchanged);
-- 'assigned' is a new direct-assignment flow for office manager/HR to build
-- a preplanned weekly schedule that bypasses claiming entirely. Assigned
-- shifts never appear on the Shift Board and are visible to every employee
-- (read-only) on a new team-wide Weekly Schedule view.
--
-- No RLS changes: shifts_select_all already lets every employee read every
-- shift regardless of type, and shifts_write_admin already lets
-- admin/office_manager write any column, including the new ones.

create type public.shift_schedule_type as enum ('marketplace', 'assigned');

alter table public.shifts
  add column schedule_type public.shift_schedule_type not null default 'marketplace',
  add column assigned_to uuid references public.employees (id) on delete set null;

create index shifts_schedule_type_date_idx on public.shifts (schedule_type, date);
create index shifts_assigned_to_idx on public.shifts (assigned_to);
