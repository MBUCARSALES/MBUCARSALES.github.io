-- ============================================================================
-- MBU CAR SALES — SCHEMA v3: THE PRICE BOOK
-- ----------------------------------------------------------------------------
-- Run AFTER schema.sql and schema-v2-additions.sql.
-- Safe to run more than once.
--
-- What this is for:
--   The bidding tool works backwards from what you'd sell a car for. That
--   number was previously a guess. Now, when you check Auto Trader at the
--   auction, you record what you actually saw — and the next time that model
--   comes up, it's already there.
--
--   Over a few months this becomes your own price book for the cars you
--   actually trade, which nobody else has.
--
-- Private. Never exposed to the website.
-- ============================================================================

create table if not exists public.price_checks (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),

  -- what was looked up
  make        text not null,
  model       text,
  year        integer,
  mileage     integer,

  -- what was seen advertised
  low         integer,
  typical     integer,
  high        integer,
  sample_size integer,           -- how many similar cars were on screen

  source      text not null default 'autotrader'
                check (source in ('autotrader','other','own_judgement')),
  notes       text,

  -- if this check led to a bid, what happened
  car_id      uuid references public.cars(id) on delete set null
);

create index if not exists price_checks_lookup_idx
  on public.price_checks (lower(make), lower(coalesce(model,'')), created_at desc);
create index if not exists price_checks_created_idx
  on public.price_checks (created_at desc);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'price_checks_size_guard') then
    alter table public.price_checks add constraint price_checks_size_guard check (
      char_length(make)                  <= 60   and
      char_length(coalesce(model, ''))   <= 80   and
      char_length(coalesce(notes, ''))   <= 1000
    );
  end if;
end $$;

-- ---------------------------------------------------------------- SECURITY
alter table public.price_checks enable row level security;

-- Admins only, in every direction. This is commercially sensitive — it is
-- literally a record of what you think cars are worth.
drop policy if exists "admins read price checks" on public.price_checks;
create policy "admins read price checks"
  on public.price_checks for select to authenticated using (public.is_admin());

drop policy if exists "admins write price checks" on public.price_checks;
create policy "admins write price checks"
  on public.price_checks for insert to authenticated with check (public.is_admin());

drop policy if exists "admins update price checks" on public.price_checks;
create policy "admins update price checks"
  on public.price_checks for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins delete price checks" on public.price_checks;
create policy "admins delete price checks"
  on public.price_checks for delete to authenticated using (public.is_admin());

revoke all on public.price_checks from anon;
grant select, insert, update, delete on public.price_checks to authenticated;


-- ============================================================================
-- THE PRICE BOOK VIEW
-- One row per make/model: what you've seen them advertised at, and what you
-- have actually achieved. The two together are far more useful than either.
-- ============================================================================
drop view if exists public.price_book;

create view public.price_book as
with checks as (
  select
    lower(make)                       as make_key,
    lower(coalesce(model, ''))        as model_key,
    max(make)                         as make,
    max(coalesce(model, ''))          as model,
    count(*)                          as checks,
    round(avg(nullif(typical, 0)))    as avg_seen,
    min(nullif(low, 0))               as lowest_seen,
    max(nullif(high, 0))              as highest_seen,
    max(created_at)                   as last_checked
  from public.price_checks
  group by 1, 2
),
traded as (
  select
    lower(make)                       as make_key,
    lower(coalesce(model, ''))        as model_key,
    count(*) filter (where status = 'sold')                          as sold_count,
    round(avg(coalesce(sale_price, price)) filter (where status = 'sold')) as avg_achieved,
    round(avg(purchase_price))                                       as avg_paid,
    round(avg(
      case when sale_price is not null and purchase_price is not null
        then sale_price - purchase_price - coalesce(prep_cost, 0) end
    ))                                                               as avg_margin,
    round(avg(
      case when sold_at is not null
        then extract(day from (sold_at - coalesce(listed_at, created_at))) end
    ))                                                               as avg_days
  from public.cars
  group by 1, 2
)
select
  coalesce(c.make, t.make_key)   as make,
  nullif(coalesce(c.model, t.model_key), '') as model,
  c.checks, c.avg_seen, c.lowest_seen, c.highest_seen, c.last_checked,
  t.sold_count, t.avg_achieved, t.avg_paid, t.avg_margin, t.avg_days
from checks c
full outer join traded t
  on t.make_key = c.make_key and t.model_key = c.model_key
where coalesce(c.checks, 0) > 0 or coalesce(t.sold_count, 0) > 0
order by coalesce(c.last_checked, now() - interval '10 years') desc;

alter view public.price_book set (security_invoker = true);
grant select on public.price_book to authenticated;

comment on view public.price_book is
  'What you have seen cars advertised at, next to what you actually achieved. Admin only.';


notify pgrst, 'reload schema';


-- ============================================================================
-- CHECK IT WORKED
-- ============================================================================
-- Should return an empty table, not an error:
--   select * from public.price_book;

-- Must return FALSE — the price book is commercially sensitive:
--   select has_table_privilege('anon', 'public.price_checks', 'select');
