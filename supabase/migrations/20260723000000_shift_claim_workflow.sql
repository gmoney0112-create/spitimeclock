-- Shift board workflow: a pending claim marks the shift `claimed` (still
-- open to competing claims); an admin decision either fills the shift
-- (denying every other pending claim in the same transaction) or, if
-- denied with nothing else pending, reopens it. The partial unique index
-- from the initial migration (one approved claim per shift, ever) is what
-- actually makes "two employees claim the same shift" resolve
-- predictably at the database level -- these RPCs just drive the rest of
-- the workflow around that guarantee.

create function private.mark_shift_claimed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.shifts
  set status = 'claimed'
  where id = new.shift_id
    and status = 'open';

  return new;
end;
$$;

create trigger shift_claims_mark_claimed
  after insert on public.shift_claims
  for each row execute function private.mark_shift_claimed();

create function public.approve_shift_claim(p_claim_id uuid)
returns public.shift_claims
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift_id uuid;
  v_claim public.shift_claims;
begin
  if not private.is_admin_or_manager() then
    raise exception 'not authorized';
  end if;

  select shift_id into v_shift_id from public.shift_claims where id = p_claim_id;
  if not found then
    raise exception 'claim % not found', p_claim_id;
  end if;

  begin
    update public.shift_claims
    set status = 'approved', decided_by = private.current_employee_id(), decided_at = now()
    where id = p_claim_id
      and status = 'pending'
    returning * into v_claim;
  exception
    when unique_violation then
      raise exception 'This shift already has an approved claim.';
  end;

  if not found then
    raise exception 'Claim % is no longer pending.', p_claim_id;
  end if;

  update public.shift_claims
  set status = 'denied', decided_by = private.current_employee_id(), decided_at = now()
  where shift_id = v_shift_id
    and id <> p_claim_id
    and status = 'pending';

  update public.shifts set status = 'filled' where id = v_shift_id;

  return v_claim;
end;
$$;

grant execute on function public.approve_shift_claim(uuid) to authenticated;

create function public.deny_shift_claim(p_claim_id uuid)
returns public.shift_claims
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift_id uuid;
  v_claim public.shift_claims;
  v_remaining_pending int;
begin
  if not private.is_admin_or_manager() then
    raise exception 'not authorized';
  end if;

  update public.shift_claims
  set status = 'denied', decided_by = private.current_employee_id(), decided_at = now()
  where id = p_claim_id
    and status = 'pending'
  returning * into v_claim;

  if not found then
    raise exception 'Claim % is not pending.', p_claim_id;
  end if;

  v_shift_id := v_claim.shift_id;

  select count(*) into v_remaining_pending
  from public.shift_claims
  where shift_id = v_shift_id and status = 'pending';

  if v_remaining_pending = 0 then
    update public.shifts
    set status = 'open'
    where id = v_shift_id and status = 'claimed';
  end if;

  return v_claim;
end;
$$;

grant execute on function public.deny_shift_claim(uuid) to authenticated;
