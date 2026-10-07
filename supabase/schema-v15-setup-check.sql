-- ============================================================================
-- MBU CAR SALES — SCHEMA v15: WHAT'S BEEN RUN
-- ----------------------------------------------------------------------------
-- Run it last, after the other files in the switch-on guide (any order works,
-- it just reports). Safe to run more than once. Adds one function and changes
-- nothing else.
--
-- The admin app's gear → Setup ticks off each step of the switch-on guide
-- (7 Oct 2026). Most of it the app can see for itself (a table is there or
-- it isn't), but three things it can't: the form limits (v9) are triggers,
-- the plate fix (v13) changes what a view sends, and the tracking lock (v6b)
-- takes a permission away from the public. This asks the database.
--
-- setup_status() → { v2: true, v3: true, …, v14: false, v6b: false } for every
-- file, plus checked_at. Admins only; it reads the database's own catalogue,
-- never anyone's data.
-- ============================================================================

create or replace function public.setup_status()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_catalog
as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Only an admin can see the setup' using errcode = '42501';
  end if;

  -- to_regclass() is null for anything missing, so no check here can fail
  return jsonb_build_object(
    'v2',  to_regclass('public.wanted_requests') is not null,
    'v3',  to_regclass('public.price_checks') is not null,
    'v4',  to_regclass('public.price_history') is not null,
    'v6',  to_regclass('public.tracking_status') is not null,
    -- The public can no longer write to car_events directly: only the track function can
    'v6b', to_regclass('public.tracking_status') is not null
           and not coalesce(has_table_privilege('anon', to_regclass('public.car_events'), 'INSERT'), true),
    'v7',  to_regclass('public.insight_actions') is not null,
    'v8',  exists (select 1 from pg_attribute
                   where attrelid = to_regclass('public.cars') and attname = 'px_sale' and not attisdropped),
    'v9',  exists (select 1 from pg_trigger
                   where tgname = 'enquiries_limit' and tgrelid = to_regclass('public.enquiries')),
    'v10', to_regclass('public.invoices') is not null and to_regclass('public.app_settings') is not null,
    'v11', to_regclass('public.instagram_posts') is not null,
    'v12', exists (select 1 from pg_constraint
                   where conname = 'price_checks_source_check' and pg_get_constraintdef(oid) like '%auction%'),
    'v13', coalesce(pg_get_viewdef(to_regclass('public.cars_public')) ilike '%null::text as registration%', false),
    'v14', exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname = 'site_stats'),
    'v15', true,
    'checked_at', now()
  );
end;
$$;

revoke all on function public.setup_status() from public, anon;
grant execute on function public.setup_status() to authenticated;

notify pgrst, 'reload schema';
