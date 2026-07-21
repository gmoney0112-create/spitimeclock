-- Powers the admin "who's on the clock" live view. Realtime still honors
-- the RLS select policies on time_punches, so employees never receive
-- punch events for anyone but themselves.

alter publication supabase_realtime add table public.time_punches;
