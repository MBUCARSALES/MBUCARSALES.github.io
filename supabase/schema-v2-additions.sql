-- ============================================================================
-- MBU CAR SALES — SCHEMA v2
-- ----------------------------------------------------------------------------
-- Adds: interest tracking, car requests, private cost fields, and the columns
-- Auto Trader Connect will need later.
--
-- HOW TO RUN:  Supabase → SQL Editor → New query → paste → Run.
--
-- Run schema.sql FIRST if you haven't already.
-- Safe to run this more than once — it will not wipe anything.
-- ============================================================================


-- ============================================================================
-- 1. NEW COLUMNS ON `cars`
-- ============================================================================

-- ---- Private figures. NEVER exposed on the website. ------------------------
-- These sit outside the public view, so they can't leak. Optional to fill in,
-- but if you do, the Insights tab can show you real margin per car.
alter table public.cars add column if not exists purchase_price integer;
alter table public.cars add column if not exists prep_cost      integer;
alter table public.cars add column if not exists sale_price     integer;  -- what it actually sold for
alter table public.cars add column if not exists private_notes  text;

comment on column public.cars.purchase_price is 'What you paid at auction. Private.';
comment on column public.cars.prep_cost      is 'Parts, MOT, bodywork, valet. Private.';
comment on column public.cars.sale_price     is 'What it actually sold for, which may differ from the advertised price. Private.';

-- ---- Auto Trader Connect compatibility ------------------------------------
-- Nothing uses these yet. They exist so that when API access is switched on,
-- no database migration and no rebuild is needed. See ROADMAP.md section 4.
alter table public.cars add column if not exists at_derivative_id   text;
alter table public.cars add column if not exists at_stock_id        text;
alter table public.cars add column if not exists at_advertiser_id   text;
alter table public.cars add column if not exists at_lifecycle_state text;   -- e.g. FORECOURT, SALE_IN_PROGRESS, SOLD
alter table public.cars add column if not exists at_published       boolean not null default false;
alter table public.cars add column if not exists at_last_synced_at  timestamptz;
alter table public.cars add column if not exists at_sync_error      text;

-- Valuation + market data, shaped to match what Auto Trader returns
alter table public.cars add column if not exists val_retail    integer;
alter table public.cars add column if not exists val_trade     integer;
alter table public.cars add column if not exists val_partex    integer;
alter table public.cars add column if not exists retail_rating numeric(5,1);
alter table public.cars add column if not exists days_to_sell  integer;
alter table public.cars add column if not exists val_updated_at timestamptz;

comment on column public.cars.at_derivative_id is
  'Auto Trader derivative ID — the exact model/trim. Fills the gap the DVLA leaves.';
comment on column public.cars.retail_rating is
  'Auto Trader Retail Rating 0-100. How well this car should sell at this price.';

-- Useful for the ageing report and days-in-stock insight
alter table public.cars add column if not exists listed_at timestamptz;
update public.cars set listed_at = created_at where listed_at is null;


-- ============================================================================
-- 2. `car_events` — anonymous interest tracking
-- ----------------------------------------------------------------------------
-- No cookies. No device identifiers. No IP addresses. Nothing that could
-- identify a person, which is exactly why no consent banner is needed.
--
-- `session_key` is a random value that lives in memory for one browsing
-- session and is thrown away when the tab closes. It exists ONLY to stop the
-- same person's page refreshes being counted ten times. It cannot be linked
-- to a person, a device, or a previous visit.
-- ============================================================================
create table if not exists public.car_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  car_id      uuid references public.cars(id) on delete cascade,
  event_type  text not null check (event_type in (
                'view',            -- car detail page opened
                'card_click',      -- clicked through from a listing
                'gallery_open',    -- opened the full-screen photos
                'whatsapp_click',
                'phone_click',
                'enquiry_start',   -- began filling the form
                'enquiry_sent',
                'interest_sent',   -- registered interest in a sold car
                'share'
              )),
  session_key text,                -- random, session-scoped, non-identifying
  source      text,                -- 'stock' | 'home' | 'direct' | 'search'
  meta        jsonb
);

create index if not exists car_events_car_idx     on public.car_events (car_id, created_at desc);
create index if not exists car_events_type_idx    on public.car_events (event_type, created_at desc);
create index if not exists car_events_created_idx on public.car_events (created_at desc);

-- Keep the payload small so nobody can dump junk into it
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'car_events_size_guard') then
    alter table public.car_events add constraint car_events_size_guard check (
      char_length(coalesce(session_key, '')) <= 64  and
      char_length(coalesce(source, ''))      <= 40  and
      pg_column_size(coalesce(meta, '{}'::jsonb))   <= 2000
    );
  end if;
end $$;


-- ============================================================================
-- 3. `wanted_requests` — register interest + car finder
-- ----------------------------------------------------------------------------
-- This is the demand data. Over time it answers: what are people asking for
-- that we don't stock? Which sold cars pull the most "have you got another?"
-- ============================================================================
create table if not exists public.wanted_requests (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),

  kind         text not null default 'wanted'
                 check (kind in ('sold_interest','wanted')),

  -- Set when the request came from a specific sold car
  car_id       uuid references public.cars(id) on delete set null,
  car_title    text,

  -- Who
  name         text,
  phone        text,
  email        text,
  contact_pref text,               -- 'whatsapp' | 'call' | 'email'

  -- What they're after (this is the valuable part)
  make         text,
  model        text,
  body_type    text,
  fuel         text,
  transmission text,
  budget_min   integer,
  budget_max   integer,
  max_mileage  integer,
  year_from    integer,
  timescale    text,               -- 'asap' | 'few_weeks' | 'few_months' | 'looking'
  part_ex      boolean not null default false,
  part_ex_details text,
  notes        text,

  -- Workflow
  status       text not null default 'new'
                 check (status in ('new','searching','matched','bought_elsewhere','closed')),
  admin_notes  text,
  is_read      boolean not null default false,
  archived     boolean not null default false
);

create index if not exists wanted_created_idx on public.wanted_requests (created_at desc);
create index if not exists wanted_status_idx  on public.wanted_requests (status) where not archived;
create index if not exists wanted_make_idx    on public.wanted_requests (make, model);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'wanted_size_guard') then
    alter table public.wanted_requests add constraint wanted_size_guard check (
      char_length(coalesce(name, ''))            <= 120  and
      char_length(coalesce(phone, ''))           <= 40   and
      char_length(coalesce(email, ''))           <= 200  and
      char_length(coalesce(make, ''))            <= 60   and
      char_length(coalesce(model, ''))           <= 80   and
      char_length(coalesce(notes, ''))           <= 3000 and
      char_length(coalesce(part_ex_details, '')) <= 1000
    );
  end if;
end $$;


-- ============================================================================
-- 4. SECURITY
-- ============================================================================
alter table public.car_events      enable row level security;
alter table public.wanted_requests enable row level security;

-- Anyone can record an event or submit a request. Nobody but an admin can read.
drop policy if exists "anyone records an event" on public.car_events;
create policy "anyone records an event"
  on public.car_events for insert to anon, authenticated with check (true);

drop policy if exists "admins read events" on public.car_events;
create policy "admins read events"
  on public.car_events for select to authenticated using (public.is_admin());

drop policy if exists "admins delete events" on public.car_events;
create policy "admins delete events"
  on public.car_events for delete to authenticated using (public.is_admin());

drop policy if exists "anyone submits a request" on public.wanted_requests;
create policy "anyone submits a request"
  on public.wanted_requests for insert to anon, authenticated with check (true);

drop policy if exists "admins read requests" on public.wanted_requests;
create policy "admins read requests"
  on public.wanted_requests for select to authenticated using (public.is_admin());

drop policy if exists "admins update requests" on public.wanted_requests;
create policy "admins update requests"
  on public.wanted_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins delete requests" on public.wanted_requests;
create policy "admins delete requests"
  on public.wanted_requests for delete to authenticated using (public.is_admin());

-- Identity columns manage their own sequence, so no sequence grant is needed.
grant insert                         on public.car_events      to anon;
grant select, insert, delete         on public.car_events      to authenticated;

grant insert                         on public.wanted_requests to anon;
grant select, insert, update, delete on public.wanted_requests to authenticated;


-- ============================================================================
-- 5. REBUILD THE PUBLIC VIEW
-- ----------------------------------------------------------------------------
-- Sold cars now stay visible for 45 days (mixed into the main stock grid).
-- Their price is still stripped out, and so is every private cost field.
-- ============================================================================
drop view if exists public.cars_public;

create view public.cars_public as
select
  id, created_at, updated_at, listed_at, status, featured, sort_index,
  registration, make, model, variant, year,
  case when status = 'sold' then null else price end as price,
  mileage, fuel, transmission, body_type, doors, engine_size, colour,
  previous_owners, mot_expiry, service_history, hpi_status,
  condition_notes, description, features, images, sold_at, slug
  -- deliberately NOT selected: purchase_price, prep_cost, sale_price,
  -- private_notes, val_*, retail_rating, days_to_sell, at_* — all private.
from public.cars
where status in ('available','reserved')
   or (status = 'sold' and sold_at is not null
       and sold_at > now() - interval '45 days');

alter view public.cars_public set (security_invoker = false);

comment on view public.cars_public is
  'What the website reads. Hides sold prices, all cost data and all Auto Trader fields.';

grant select on public.cars_public to anon, authenticated;


-- ============================================================================
-- 6. AGGREGATION VIEWS — power the Insights tab
-- Admin-only. Doing the counting in the database keeps the phone app fast.
-- ============================================================================

-- ---- Per-car totals -------------------------------------------------------
drop view if exists public.car_stats;

create view public.car_stats as
select
  c.id                                    as car_id,
  c.make, c.model, c.variant, c.year, c.status, c.price,
  c.created_at, c.listed_at, c.sold_at,
  c.purchase_price, c.prep_cost, c.sale_price,

  -- days the car has been (or was) on sale
  case
    when c.sold_at is not null
      then greatest(0, extract(day from (c.sold_at - coalesce(c.listed_at, c.created_at)))::int)
    else greatest(0, extract(day from (now() - coalesce(c.listed_at, c.created_at)))::int)
  end                                     as days_in_stock,

  -- margin, only when you've filled the private figures in
  case
    when c.sale_price is not null and c.purchase_price is not null
      then c.sale_price - c.purchase_price - coalesce(c.prep_cost, 0)
  end                                     as margin,

  coalesce(e.views, 0)          as views,
  coalesce(e.card_clicks, 0)    as card_clicks,
  coalesce(e.gallery_opens, 0)  as gallery_opens,
  coalesce(e.whatsapp, 0)       as whatsapp_clicks,
  coalesce(e.phone, 0)          as phone_clicks,
  coalesce(e.enquiries, 0)      as enquiries,
  coalesce(e.interest, 0)       as interest_registered,

  -- of everyone who looked, how many made contact
  case when coalesce(e.views, 0) > 0
    then round(100.0 * (coalesce(e.whatsapp,0) + coalesce(e.phone,0)
                        + coalesce(e.enquiries,0) + coalesce(e.interest,0))
               / e.views, 1)
  end                                     as contact_rate_pct

from public.cars c
left join (
  select
    car_id,
    count(*) filter (where event_type = 'view')           as views,
    count(*) filter (where event_type = 'card_click')     as card_clicks,
    count(*) filter (where event_type = 'gallery_open')   as gallery_opens,
    count(*) filter (where event_type = 'whatsapp_click') as whatsapp,
    count(*) filter (where event_type = 'phone_click')    as phone,
    count(*) filter (where event_type = 'enquiry_sent')   as enquiries,
    count(*) filter (where event_type = 'interest_sent')  as interest
  from public.car_events
  group by car_id
) e on e.car_id = c.id;

alter view public.car_stats set (security_invoker = true);   -- admins only, via RLS
grant select on public.car_stats to authenticated;

-- ---- Demand summary: what people ask for that we may not stock ------------
drop view if exists public.demand_summary;

create view public.demand_summary as
select
  coalesce(nullif(trim(make), ''),  'Not specified') as make,
  coalesce(nullif(trim(model), ''), 'Any')           as model,
  count(*)                                           as requests,
  round(avg(nullif(budget_max, 0)))                  as avg_budget,
  min(budget_min)                                    as lowest_budget,
  max(budget_max)                                    as highest_budget,
  count(*) filter (where kind = 'sold_interest')     as from_sold_cars,
  count(*) filter (where status = 'new')             as still_open,
  max(created_at)                                    as latest_request
from public.wanted_requests
where not archived
group by 1, 2
order by requests desc, latest_request desc;

alter view public.demand_summary set (security_invoker = true);
grant select on public.demand_summary to authenticated;

-- ---- Daily activity, for trends over time ---------------------------------
drop view if exists public.activity_daily;

create view public.activity_daily as
select
  date_trunc('day', created_at)::date                   as day,
  count(*) filter (where event_type = 'view')           as views,
  count(*) filter (where event_type = 'whatsapp_click') as whatsapp_clicks,
  count(*) filter (where event_type = 'phone_click')    as phone_clicks,
  count(*) filter (where event_type = 'enquiry_sent')   as enquiries,
  count(*) filter (where event_type = 'interest_sent')  as interest,
  count(distinct session_key)                           as sessions
from public.car_events
group by 1
order by 1 desc;

alter view public.activity_daily set (security_invoker = true);
grant select on public.activity_daily to authenticated;


-- ============================================================================
-- 7. HOUSEKEEPING
-- Raw events are only needed for recent detail; the daily view keeps history.
-- Run this occasionally, or ignore it — 12 months of events is a few MB.
-- ============================================================================
-- delete from public.car_events where created_at < now() - interval '18 months';


notify pgrst, 'reload schema';


-- ============================================================================
-- 8. CHECK IT WORKED
-- ============================================================================
-- Should list cars with a views column (all zero until the site gets traffic):
--   select make, model, status, days_in_stock, views, enquiries from public.car_stats;

-- Should be empty until someone submits a request:
--   select * from public.demand_summary;

-- Must return FALSE — proves cost data is unreachable by the public:
--   select has_column_privilege('anon', 'public.cars', 'purchase_price', 'select');
