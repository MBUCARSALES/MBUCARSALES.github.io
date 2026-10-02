-- ============================================================================
-- MBU CAR SALES — SCHEMA v8: PART EXCHANGE SALES
-- ----------------------------------------------------------------------------
-- Run after the others (any time after schema-v2-additions.sql). Safe to run
-- more than once. Adds only: three columns on cars, nothing else changes.
--
-- When a car is sold with a part exchange, the profit isn't on that car. The
-- car taken in goes into stock at what the sold one cost you minus the cash
-- the buyer paid, so the profit on the whole deal shows when IT sells. The
-- admin app then leaves the part-exchange sale out of the margin, the average
-- per car, the monthly charts and the haggle %, and still counts it as a car
-- sold. (If the cash alone covered what the car cost, the extra is profit
-- made on the day and is counted, and the car taken in goes in at £0.)
--
--   · px_sale   on the car you sold: it went with a part exchange
--   · px_cash   on the car you sold: the cash they paid on top of their car
--   · px_from   on the car you took in: which sale it came in on
--
-- Private: cars_public lists its columns one by one, so none of these reach
-- the website. Until this is run the app hides nothing and breaks nothing;
-- More → Ready to switch on says it's waiting.
-- ============================================================================

alter table public.cars add column if not exists px_sale boolean not null default false;
alter table public.cars add column if not exists px_cash integer;
alter table public.cars add column if not exists px_from uuid references public.cars(id) on delete set null;

comment on column public.cars.px_sale is
  'Sold with a part exchange. Its profit is carried onto the car taken in (px_from points back here).';
comment on column public.cars.px_cash is
  'On a part-exchange sale: the cash the buyer paid on top of their car.';
comment on column public.cars.px_from is
  'On a car taken in part exchange: the car it was taken in against. Its cost is that car''s cost minus px_cash.';

create index if not exists cars_px_from_idx on public.cars (px_from) where px_from is not null;

-- ----------------------------------------------------------------------------
-- Check it worked (both should run without an error):
--   select px_sale, px_cash, px_from from public.cars limit 1;
--   select count(*) from public.cars where px_sale;          -- 0 to start with
--
-- And that the website still can't see them (should say the column doesn't exist):
--   select px_sale from public.cars_public limit 1;
--
-- Undo (loses which sales were part exchanges):
--   alter table public.cars drop column if exists px_from;
--   alter table public.cars drop column if exists px_cash;
--   alter table public.cars drop column if exists px_sale;
-- ----------------------------------------------------------------------------
