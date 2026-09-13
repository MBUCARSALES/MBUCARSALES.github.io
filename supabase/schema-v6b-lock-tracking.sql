-- ============================================================================
-- MBU CAR SALES — SCHEMA v6b: STOP THE PUBLIC WRITING EVENTS DIRECTLY
-- ----------------------------------------------------------------------------
-- ⚠️  DO NOT RUN THIS UNTIL ALL THREE ARE TRUE:
--     1. schema-v6-tracking.sql has been run
--     2. the `track` Edge Function is deployed and working
--     3. config.js has  tracking: { via: 'function' }  and that is live on the
--        website, and new rows are arriving with tracking_v = 2
--
-- Until now anyone could POST straight to /rest/v1/car_events with the public
-- key and invent views. Once every event goes through the `track` function
-- (which writes with its own server-side key), that door can be shut.
--
-- Running this early stops ALL tracking until the three steps above are done.
-- Nothing else on the website is affected: enquiries and car requests have
-- their own rules and are untouched.
--
-- To undo: run the two statements at the bottom.
-- ============================================================================

drop policy if exists "anyone records an event" on public.car_events;
revoke insert on public.car_events from anon;

-- Signed-in admins never write events either; only the function does.
drop policy if exists "admins record events" on public.car_events;
revoke insert on public.car_events from authenticated;

notify pgrst, 'reload schema';


-- ============================================================================
-- CHECK IT WORKED — must return FALSE:
--   select has_table_privilege('anon', 'public.car_events', 'insert');
-- ============================================================================

-- ============================================================================
-- UNDO (only if you need to go back to direct tracking):
--   grant insert on public.car_events to anon, authenticated;
--   create policy "anyone records an event" on public.car_events
--     for insert to anon, authenticated with check (true);
-- ============================================================================
