-- within_geofence = null previously meant two different things with no way
-- to tell them apart: "this punch was never expected to be geofenced" (no
-- site involved) and "a site was expected but no GPS coordinates ever
-- arrived" (permission denied, geolocation unavailable/timed out). The
-- second case is a real anomaly worth admin's attention -- silently
-- treating it the same as "not applicable" defeats the point of
-- geofencing whenever location access fails, which real employees will
-- hit in the field, not just test tooling.
--
-- Distinguish them by whether the punch's shift has a site at all:
-- shift has a site + lat/lng missing  -> 'missing_location' (flagged)
-- shift has a site + within_geofence = false -> 'out_of_range' (flagged)
-- otherwise -> not flagged (no site to check, or verified in range)

-- CREATE OR REPLACE can't change a function's return type; the added
-- `reason` output column requires dropping the old signature first.
drop function if exists public.list_flagged_punches();

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
  longitude numeric,
  reason text
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
    tp.punch_type, tp.timestamp, tp.latitude, tp.longitude,
    case
      when tp.within_geofence = false then 'out_of_range'
      else 'missing_location'
    end
  from public.time_punches tp
  join public.employees e on e.id = tp.employee_id
  join public.shifts sh on sh.id = tp.shift_id
  join public.sites s on s.id = sh.site_id
  where tp.within_geofence = false
     or (tp.within_geofence is null and tp.latitude is null and sh.site_id is not null)
  order by tp.timestamp desc
  limit 100;
end;
$$;

grant execute on function public.list_flagged_punches() to authenticated;
