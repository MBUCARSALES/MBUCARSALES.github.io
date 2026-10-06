-- ============================================================================
-- MBU CAR SALES — SCHEMA v13: NO NUMBER PLATES ON THE WEBSITE
-- ----------------------------------------------------------------------------
-- Run after the others (any time after schema-v4-pricing-video.sql). Safe to
-- run more than once. Changes only the public view.
--
-- The website no longer shows a car's registration (Talha, 6 Oct 2026). The
-- pages stopped printing it, but the view the website reads still sent it to
-- every visitor's browser. This sends it as empty instead.
--
-- The plate stays in `cars` for the admin app (invoices, MOT dates, the bid
-- tool, Autotrader), which reads the table directly, not this view.
--
-- Same columns, same order, same type, so `create or replace` keeps the
-- view's grants and nothing that reads it breaks: `registration` is just
-- always null. Everything else is exactly as in schema-v4-pricing-video.sql.
-- ============================================================================

create or replace view public.cars_public as
select
  id, created_at, updated_at, listed_at, status, featured, sort_index,
  null::text as registration,
  make, model, variant, year,
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
  'What the website reads. Hides sold prices, cost data, Auto Trader fields and '
  'the registration (always null since v13). Reduced-price flags expire after 14 days.';

-- Check (should say registration_sent = 0):
--   select count(registration) as registration_sent from public.cars_public;
