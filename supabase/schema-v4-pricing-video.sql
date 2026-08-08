-- ============================================================================
-- MBU CAR SALES — SCHEMA v4
-- ----------------------------------------------------------------------------
-- Run AFTER schema.sql, schema-v2-additions.sql and schema-v3-price-book.sql.
-- Safe to run more than once.
--
-- Adds:
--   · price change history, with automatic "reduced" flagging
--   · walkaround video on a car
--   · part exchange and finance interest on enquiries
--   · a stock ageing view for the price-review worklist
-- ============================================================================


-- ============================================================================
-- 1. NEW COLUMNS
-- ============================================================================

-- ---- Price movement --------------------------------------------------------
-- previous_price is only meaningful while price_reduced_at is recent; both are
-- set automatically by the trigger below, never by hand.
alter table public.cars add column if not exists previous_price   integer;
alter table public.cars add column if not exists price_reduced_at timestamptz;

comment on column public.cars.previous_price is
  'What the car was priced at before the most recent reduction. Set automatically.';

-- ---- Walkaround video ------------------------------------------------------
-- {public_id, duration, width, height}
alter table public.cars add column if not exists video jsonb;

-- ---- Enquiry extras --------------------------------------------------------
alter table public.enquiries add column if not exists part_ex          boolean not null default false;
alter table public.enquiries add column if not exists part_ex_details  text;
alter table public.enquiries add column if not exists finance_interest boolean not null default false;

comment on column public.enquiries.finance_interest is
  'Customer ticked "interested in finance". Capturing the interest only. '
  'Arranging or brokering finance requires FCA authorisation — see ROADMAP.md.';


-- ============================================================================
-- 1b. STAMP listed_at WHEN A CAR FIRST GOES ON SALE
-- ----------------------------------------------------------------------------
-- "Days in stock" should count from the day a car went on the website, not the
-- day the record was created. Without this, a car saved as a draft on Monday
-- and published the following Friday would already show as 5 days old, and the
-- ageing worklist would nag about cars that have barely been listed.
-- ============================================================================
create or replace function public.stamp_listed_at()
returns trigger language plpgsql as $$
begin
  if new.status in ('available','reserved') and new.listed_at is null then
    new.listed_at := now();
  end if;
  return new;
end $$;

drop trigger if exists cars_stamp_listed_at_ins on public.cars;
create trigger cars_stamp_listed_at_ins
  before insert on public.cars
  for each row execute function public.stamp_listed_at();

drop trigger if exists cars_stamp_listed_at_upd on public.cars;
create trigger cars_stamp_listed_at_upd
  before update on public.cars
  for each row execute function public.stamp_listed_at();

-- Backfill anything already in the table
update public.cars set listed_at = created_at
 where listed_at is null and status in ('available','reserved','sold');


-- ============================================================================
-- 2. PRICE HISTORY
-- Every price change, recorded automatically. Tells you whether dropping the
-- price on a car that is sitting actually does anything.
-- ============================================================================
create table if not exists public.price_history (
  id         bigint generated always as identity primary key,
  car_id     uuid not null references public.cars(id) on delete cascade,
  changed_at timestamptz not null default now(),
  old_price  integer,
  new_price  integer,
  direction  text generated always as (
               case
                 when old_price is null then 'initial'
                 when new_price < old_price then 'down'
                 when new_price > old_price then 'up'
                 else 'same'
               end
             ) stored,
  reason     text
);

create index if not exists price_history_car_idx
  on public.price_history (car_id, changed_at desc);

-- Record the change and flag the car as reduced, in one place so it can never
-- be forgotten or faked from the app.
create or replace function public.track_price_change()
returns trigger language plpgsql as $$
begin
  if new.price is distinct from old.price then
    insert into public.price_history (car_id, old_price, new_price)
    values (new.id, old.price, new.price);

    if old.price is not null and new.price is not null and new.price < old.price then
      new.previous_price   := old.price;
      new.price_reduced_at := now();
    elsif new.price is not null and old.price is not null and new.price > old.price then
      -- Price went back up: stop claiming it is reduced.
      new.previous_price   := null;
      new.price_reduced_at := null;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists cars_track_price on public.cars;
create trigger cars_track_price
  before update on public.cars
  for each row execute function public.track_price_change();

alter table public.price_history enable row level security;

drop policy if exists "admins read price history" on public.price_history;
create policy "admins read price history"
  on public.price_history for select to authenticated using (public.is_admin());

drop policy if exists "admins write price history" on public.price_history;
create policy "admins write price history"
  on public.price_history for insert to authenticated with check (public.is_admin());

revoke all on public.price_history from anon;
grant select, insert on public.price_history to authenticated;


-- ============================================================================
-- 3. REBUILD THE PUBLIC VIEW
-- Adds the video and the reduced-price fields.
--
-- "Reduced" only shows for 14 days, and only on cars still for sale. A badge
-- that never expires stops meaning anything, and claiming a sold car was
-- reduced would be misleading.
-- ============================================================================
drop view if exists public.cars_public;

create view public.cars_public as
select
  id, created_at, updated_at, listed_at, status, featured, sort_index,
  registration, make, model, variant, year,
  case when status = 'sold' then null else price end as price,

  case
    when status in ('available','reserved')
     and price_reduced_at is not null
     and price_reduced_at > now() - interval '14 days'
    then previous_price
  end as previous_price,

  case
    when status in ('available','reserved')
     and price_reduced_at is not null
     and price_reduced_at > now() - interval '14 days'
    then price_reduced_at
  end as price_reduced_at,

  mileage, fuel, transmission, body_type, doors, engine_size, colour,
  previous_owners, mot_expiry, service_history, hpi_status,
  condition_notes, description, features, images, video, sold_at, slug
from public.cars
where status in ('available','reserved')
   or (status = 'sold' and sold_at is not null
       and sold_at > now() - interval '45 days');

alter view public.cars_public set (security_invoker = false);
grant select on public.cars_public to anon, authenticated;

comment on view public.cars_public is
  'What the website reads. Hides sold prices, cost data and Auto Trader fields. '
  'Reduced-price flags expire after 14 days.';


-- ============================================================================
-- 4. STOCK AGEING — the price review worklist
-- ============================================================================
drop view if exists public.stock_ageing;

create view public.stock_ageing as
select
  c.id, c.make, c.model, c.variant, c.year, c.price, c.status,
  c.previous_price, c.price_reduced_at, c.purchase_price, c.prep_cost,

  greatest(0, extract(day from (now() - coalesce(c.listed_at, c.created_at)))::int) as days_in_stock,

  case
    when greatest(0, extract(day from (now() - coalesce(c.listed_at, c.created_at)))::int) >= 90 then 'critical'
    when greatest(0, extract(day from (now() - coalesce(c.listed_at, c.created_at)))::int) >= 60 then 'overdue'
    when greatest(0, extract(day from (now() - coalesce(c.listed_at, c.created_at)))::int) >= 45 then 'watch'
    else 'fine'
  end as ageing,

  -- days since the last price change, so we know if a review is overdue
  (select max(changed_at) from public.price_history h where h.car_id = c.id) as last_price_change,

  -- what you have actually achieved on this model before
  (select round(avg(coalesce(s.sale_price, s.price)))
     from public.cars s
    where s.status = 'sold'
      and lower(s.make) = lower(c.make)
      and lower(coalesce(s.model,'')) = lower(coalesce(c.model,''))) as avg_achieved,

  -- and how long those took
  (select round(avg(extract(day from (s.sold_at - coalesce(s.listed_at, s.created_at)))))
     from public.cars s
    where s.status = 'sold' and s.sold_at is not null
      and lower(s.make) = lower(c.make)
      and lower(coalesce(s.model,'')) = lower(coalesce(c.model,''))) as avg_days_to_sell,

  coalesce(e.views, 0)     as views,
  coalesce(e.contacts, 0)  as contacts

from public.cars c
left join (
  select car_id,
         count(*) filter (where event_type = 'view') as views,
         count(*) filter (where event_type in
           ('whatsapp_click','phone_click','enquiry_sent','interest_sent')) as contacts
  from public.car_events group by car_id
) e on e.car_id = c.id
where c.status in ('available','reserved')
order by days_in_stock desc;

alter view public.stock_ageing set (security_invoker = true);
grant select on public.stock_ageing to authenticated;


notify pgrst, 'reload schema';


-- ============================================================================
-- 5. CHECK IT WORKED
-- ============================================================================
-- Change a car's price in the app, then:
--   select * from public.price_history order by changed_at desc limit 5;

-- Drop a price and this should show the old one; raise it again and it clears:
--   select make, model, price, previous_price, price_reduced_at from public.cars_public;

-- The price review worklist, oldest first:
--   select make, model, days_in_stock, ageing, views, contacts from public.stock_ageing;
