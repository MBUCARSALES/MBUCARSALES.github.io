-- ============================================================================
-- MBU CAR SALES — SCHEMA v7: INSIGHT DECISIONS AND AUTO TRADER MARKET DATA
-- ----------------------------------------------------------------------------
-- Run AFTER schema-v6-tracking.sql. Safe to run more than once. Adds only.
--
-- Adds:
--   · insight_actions  what you decided about an insight: "price is right",
--                      "remind me in 7 days", "dropped the price". Kept in the
--                      database so both phones see the same thing.
--   · Auto Trader market figures on each car (price indicator, the price
--     bands, similar adverts), filled in when the Auto Trader connection is
--     switched on. Private, never in cars_public.
--   · price_checks can now hold checks made by the Auto Trader connection as
--     well as ones typed in by hand, so the price book fills itself.
--
-- Multi-tenant note: no tenant_id here on purpose. insight_actions joins the
-- Phase 3 tenant migration list in DECISIONS.md, so isolation is added and
-- tested in one pass across every table rather than half-done table by table.
-- ============================================================================


-- ============================================================================
-- 1. insight_actions
-- ============================================================================
create table if not exists public.insight_actions (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  car_id          uuid not null references public.cars(id) on delete cascade,

  rule            text not null,          -- which insight, e.g. no_contact, ageing
  cause           text,                   -- what it blamed, e.g. price, photos
  action          text not null check (action in ('priced_ok', 'snoozed', 'repriced', 'dismissed')),

  until           timestamptz,            -- when a snooze or "priced right" runs out
  price_at_action integer,                -- "priced right" only holds while the price is this
  new_price       integer,                -- for repriced: what it went to
  created_by      uuid default auth.uid()
);

create index if not exists insight_actions_car_idx
  on public.insight_actions (car_id, created_at desc);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'insight_actions_size_guard') then
    alter table public.insight_actions add constraint insight_actions_size_guard check (
      char_length(rule) <= 40 and char_length(coalesce(cause, '')) <= 40
    );
  end if;
end $$;

comment on table public.insight_actions is
  'Decisions taken on insight cards. "repriced" rows record which insight led to a price change, so later you can see whether acting on it worked.';

alter table public.insight_actions enable row level security;

drop policy if exists "admins read insight actions" on public.insight_actions;
create policy "admins read insight actions"
  on public.insight_actions for select to authenticated using (public.is_admin());

drop policy if exists "admins write insight actions" on public.insight_actions;
create policy "admins write insight actions"
  on public.insight_actions for insert to authenticated with check (public.is_admin());

drop policy if exists "admins update insight actions" on public.insight_actions;
create policy "admins update insight actions"
  on public.insight_actions for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins delete insight actions" on public.insight_actions;
create policy "admins delete insight actions"
  on public.insight_actions for delete to authenticated using (public.is_admin());

revoke all on public.insight_actions from anon;
grant select, insert, update, delete on public.insight_actions to authenticated;
grant select, insert, update, delete on public.insight_actions to service_role;


-- ============================================================================
-- 2. AUTO TRADER MARKET FIGURES ON cars
-- ----------------------------------------------------------------------------
-- val_retail, val_trade, val_partex, retail_rating, days_to_sell and
-- val_updated_at already exist (schema-v2). These add what the insight engine
-- needs to say "Auto Trader rates this price HIGH, good price tops out at £X".
-- None of these are in cars_public, so none of it reaches the website.
-- ============================================================================
alter table public.cars add column if not exists at_price_indicator text;   -- LOW | GREAT | GOOD | FAIR | HIGH
alter table public.cars add column if not exists at_market          jsonb;  -- bands, similar adverts, metrics

comment on column public.cars.at_market is
  'Latest Auto Trader market check: {bands, competitors:{count,low,median,high}, metrics, retail, checked_at}. Private.';


-- ============================================================================
-- 3. price_checks FROM THE AUTO TRADER CONNECTION
-- ============================================================================
alter table public.price_checks drop constraint if exists price_checks_source_check;
alter table public.price_checks add constraint price_checks_source_check
  check (source in ('autotrader', 'autotrader_api', 'other', 'own_judgement'));

alter table public.price_checks add column if not exists detail jsonb;

comment on column public.price_checks.detail is
  'For autotrader_api checks: valuations, retail rating, days to sell. Empty for checks typed in by hand.';


notify pgrst, 'reload schema';


-- ============================================================================
-- 4. CHECK IT WORKED
-- ============================================================================
-- Should return an empty table, not an error:
--   select * from public.insight_actions;

-- Must return FALSE:
--   select has_table_privilege('anon', 'public.insight_actions', 'select');

-- Must return FALSE (market data stays private):
--   select count(*) > 0 from information_schema.columns
--    where table_name = 'cars_public' and column_name = 'at_market';
