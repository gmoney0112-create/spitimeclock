-- Field Ops upgrade: sites + GPS-verified clock-in/out.
-- See CLAUDE.md Part 2 (§16-20) for the design decisions behind this.

create table public.sites (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  address text not null,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  geofence_radius_meters integer not null default 150,
  client_notes text,
  created_at timestamptz not null default now()
);

alter table public.sites enable row level security;

create policy sites_select_all on public.sites
  for select using (auth.uid() is not null);

create policy sites_write_admin on public.sites
  for all using (private.is_admin_or_manager())
  with check (private.is_admin_or_manager());

alter table public.shifts
  add column site_id uuid references public.sites (id) on delete set null;

create index shifts_site_idx on public.shifts (site_id);

alter table public.time_punches
  add column shift_id uuid references public.shifts (id) on delete set null,
  add column latitude numeric(9, 6),
  add column longitude numeric(9, 6),
  add column within_geofence boolean;

create index time_punches_shift_idx on public.time_punches (shift_id);

-- Computes within_geofence server-side from the punch's shift's site, so a
-- client can't just claim "in range" -- it overwrites whatever the client
-- sent for this column. The raw lat/lng are still self-reported by the
-- browser (an inherent limit of foreground Geolocation, not something an
-- MVP can fully close), but the flag itself isn't client-trusted.

create function private.compute_geofence_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_site public.sites;
  v_distance_meters numeric;
begin
  if new.shift_id is null or new.latitude is null or new.longitude is null then
    new.within_geofence := null;
    return new;
  end if;

  select s.*
  into v_site
  from public.shifts sh
  join public.sites s on s.id = sh.site_id
  where sh.id = new.shift_id;

  if not found then
    new.within_geofence := null;
    return new;
  end if;

  v_distance_meters := 6371000 * acos(
    least(1, greatest(-1,
      cos(radians(v_site.latitude)) * cos(radians(new.latitude)) *
        cos(radians(new.longitude) - radians(v_site.longitude)) +
      sin(radians(v_site.latitude)) * sin(radians(new.latitude))
    ))
  );

  new.within_geofence := v_distance_meters <= v_site.geofence_radius_meters;
  return new;
end;
$$;

create trigger time_punches_compute_geofence
  before insert on public.time_punches
  for each row execute function private.compute_geofence_flag();

-- Flagged (out-of-geofence) punch review, admin-only.

create function public.list_flagged_punches()
returns table (
  punch_id uuid,
  employee_id uuid,
  full_name text,
  shift_title text,
  site_name text,
  punch_type public.punch_type,
  punch_timestamp timestamptz,
  latitude numeric,
  longitude numeric
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
  select
    tp.id, tp.employee_id, e.full_name, sh.title, s.name,
    tp.punch_type, tp.timestamp, tp.latitude, tp.longitude
  from public.time_punches tp
  join public.employees e on e.id = tp.employee_id
  left join public.shifts sh on sh.id = tp.shift_id
  left join public.sites s on s.id = sh.site_id
  where tp.within_geofence = false
  order by tp.timestamp desc
  limit 100;
end;
$$;

grant execute on function public.list_flagged_punches() to authenticated;
