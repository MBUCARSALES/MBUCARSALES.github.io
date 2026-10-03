-- ============================================================================
-- MBU CAR SALES — SCHEMA v12: AUCTION RESULTS IN THE PRICE BOOK
-- ----------------------------------------------------------------------------
-- Run after the others (any time after schema-v3-price-book.sql). Safe to
-- run more than once. Changes only: one more allowed `source` on
-- price_checks, and the `detail` column if v7 hasn't added it already.
--
-- The price book so far has held what similar cars were ADVERTISED at. Now it
-- also holds what cars actually SOLD for at auction (BCA, Manheim, Aston
-- Barclay...), seen and typed in from the admin app's Price book:
--
--   source = 'auction'
--   typical     the hammer price
--   created_at  the day of the sale
--   detail      { house, hpi, grade, fees_included }
--
-- They're kept apart from the advertised figures on purpose: the insight
-- engine's "what similar cars are up for" never counts an auction price
-- (admin/insights-engine.js), because a hammer price is a trade price, not
-- what the car sells for on a forecourt. The bid tool shows them on their
-- own line instead.
--
-- Private, like the rest of the price book: never on the website.
-- ============================================================================

alter table public.price_checks add column if not exists detail jsonb;

alter table public.price_checks drop constraint if exists price_checks_source_check;
alter table public.price_checks add constraint price_checks_source_check
  check (source in ('autotrader', 'autotrader_api', 'other', 'own_judgement', 'auction'));

create index if not exists price_checks_source_idx on public.price_checks (source, created_at desc);

-- ----------------------------------------------------------------------------
-- Check it worked (should run without an error):
--   select source, count(*) from public.price_checks group by source;
--
-- Undo (fails while any auction results are saved; delete those first):
--   alter table public.price_checks drop constraint if exists price_checks_source_check;
--   alter table public.price_checks add constraint price_checks_source_check
--     check (source in ('autotrader', 'autotrader_api', 'other', 'own_judgement'));
-- ----------------------------------------------------------------------------
