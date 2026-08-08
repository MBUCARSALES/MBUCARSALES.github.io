-- ============================================================================
-- MBU CAR SALES — DATABASE SETUP
-- ----------------------------------------------------------------------------
-- Run this ONCE in Supabase:  Dashboard → SQL Editor → New query → paste → Run.
-- Safe to run again later; it will not wipe your data.
--
-- What this creates:
--   admins     — who is allowed to manage the site
--   cars       — your stock
--   enquiries  — messages from the website
--
-- Security model:
--   * The public can READ cars that are available, reserved or sold.
--     Drafts are invisible to everyone except you.
--   * The public can SUBMIT an enquiry but can never read one back.
--   * Only signed-in users listed in `admins` can add, edit or delete anything.
-- ============================================================================


-- ============================================================================
-- 1. ADMINS
-- ============================================================================
create table if not exists public.admins (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  email    text,
  added_at timestamptz not null default now()
);

comment on table public.admins is
  'Users allowed to manage stock. Add rows AFTER creating the user in Auth → Users.';

-- Helper used by every write policy below.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;


-- ============================================================================
-- 2. CARS
-- ============================================================================
create table if not exists public.cars (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  status           text not null default 'draft'
                     check (status in ('draft','available','reserved','sold')),
  featured         boolean not null default false,
  sort_index       integer not null default 0,

  registration     text,
  make             text,
  model            text,
  variant          text,
  year             integer,

  price            integer,
  mileage          integer,

  fuel             text,
  transmission     text,
  body_type        text,
  doors            integer,
  engine_size      numeric(3,1),
  colour           text,

  previous_owners  integer,
  mot_expiry       date,
  service_history  text,
  hpi_status       text,

  condition_notes  text,
  description      text,
  features         jsonb not null default '[]'::jsonb,
  images           jsonb not null default '[]'::jsonb,

  sold_at          timestamptz,
  slug             text
);

create index if not exists cars_status_idx     on public.cars (status);
create index if not exists cars_created_idx    on public.cars (created_at desc);
create index if not exists cars_sold_at_idx    on public.cars (sold_at desc);

-- Keep updated_at honest
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists cars_touch_updated_at on public.cars;
create trigger cars_touch_updated_at
  before update on public.cars
  for each row execute function public.touch_updated_at();

-- Stamp sold_at automatically whenever a car is marked sold
create or replace function public.stamp_sold_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'sold' and (old.status is distinct from 'sold') and new.sold_at is null then
    new.sold_at = now();
  end if;
  if new.status <> 'sold' then
    new.sold_at = null;
  end if;
  return new;
end $$;

drop trigger if exists cars_stamp_sold_at on public.cars;
create trigger cars_stamp_sold_at
  before update on public.cars
  for each row execute function public.stamp_sold_at();


-- ============================================================================
-- 3. ENQUIRIES
-- ============================================================================
create table if not exists public.enquiries (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind       text not null default 'general'
               check (kind in ('general','car','sell')),
  car_id     text,
  car_title  text,
  name       text,
  phone      text,
  email      text,
  message    text,
  details    jsonb,
  is_read    boolean not null default false,
  archived   boolean not null default false
);

create index if not exists enquiries_created_idx on public.enquiries (created_at desc);
create index if not exists enquiries_unread_idx  on public.enquiries (is_read) where not archived;

-- Anyone on the internet can submit an enquiry (they have to be able to).
-- These caps stop somebody dumping megabytes into your database for fun.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'enquiries_size_guard') then
    alter table public.enquiries add constraint enquiries_size_guard check (
      char_length(coalesce(name, ''))      <= 120  and
      char_length(coalesce(phone, ''))     <= 40   and
      char_length(coalesce(email, ''))     <= 200  and
      char_length(coalesce(car_id, ''))    <= 100  and
      char_length(coalesce(car_title, '')) <= 200  and
      char_length(coalesce(message, ''))   <= 4000 and
      pg_column_size(coalesce(details, '{}'::jsonb)) <= 8000
    );
  end if;
end $$;


-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================
alter table public.cars      enable row level security;
alter table public.enquiries enable row level security;
alter table public.admins    enable row level security;

-- ---- CARS -----------------------------------------------------------------
-- NOTE: the public does NOT read this table at all. They read the
-- `cars_public` view created in section 4b, which hides sold prices.
-- Any old public-read policy is removed here.
drop policy if exists "public reads published cars" on public.cars;

drop policy if exists "admins read everything" on public.cars;
create policy "admins read everything"
  on public.cars for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admins insert cars" on public.cars;
create policy "admins insert cars"
  on public.cars for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admins update cars" on public.cars;
create policy "admins update cars"
  on public.cars for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins delete cars" on public.cars;
create policy "admins delete cars"
  on public.cars for delete
  to authenticated
  using (public.is_admin());

-- ---- ENQUIRIES ------------------------------------------------------------
-- Anyone can send one in. Nobody but an admin can ever read them back.
drop policy if exists "anyone submits an enquiry" on public.enquiries;
create policy "anyone submits an enquiry"
  on public.enquiries for insert
  to anon, authenticated
  with check (true);

drop policy if exists "admins read enquiries" on public.enquiries;
create policy "admins read enquiries"
  on public.enquiries for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admins update enquiries" on public.enquiries;
create policy "admins update enquiries"
  on public.enquiries for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins delete enquiries" on public.enquiries;
create policy "admins delete enquiries"
  on public.enquiries for delete
  to authenticated
  using (public.is_admin());

-- ---- ADMINS ---------------------------------------------------------------
-- Admins can see the list. Nobody can change it through the API —
-- adding an admin is deliberately a manual SQL job (see step 6).
drop policy if exists "admins read admin list" on public.admins;
create policy "admins read admin list"
  on public.admins for select
  to authenticated
  using (public.is_admin());


-- ============================================================================
-- 4b. THE PUBLIC VIEW  ← this is what the website actually reads
-- ----------------------------------------------------------------------------
-- Why a view instead of just reading the table?
--
--   You asked for sold cars to be shown WITHOUT the price they went for.
--   Hiding it in the web page isn't enough — anyone can open the browser's
--   network tab and read the raw data. This view strips the price out on the
--   server, so the figure never leaves the database in the first place.
--
--   It also drops sold cars older than 6 months, so the whole back catalogue
--   of what you've traded isn't sitting there for a competitor to download.
--
-- The view deliberately runs with the owner's rights (security_invoker = off)
-- so it can read the table while the public cannot.
-- ============================================================================
drop view if exists public.cars_public;

create view public.cars_public as
select
  id, created_at, updated_at, status, featured, sort_index,
  registration, make, model, variant, year,
  case when status = 'sold' then null else price end as price,   -- ← the point
  mileage, fuel, transmission, body_type, doors, engine_size, colour,
  previous_owners, mot_expiry, service_history, hpi_status,
  condition_notes, description, features, images, sold_at, slug
from public.cars
where status in ('available','reserved')
   or (status = 'sold' and sold_at is not null
       and sold_at > now() - interval '6 months');

-- Runs as the view's owner so it can read the table the public can't.
alter view public.cars_public set (security_invoker = false);

comment on view public.cars_public is
  'What the website reads. Hides the price of sold cars and anything sold over 6 months ago.';


-- ============================================================================
-- 5. EXPLICIT GRANTS
-- Supabase now requires these to be spelled out for the Data API
-- (new projects from 30 May 2026, existing projects from 30 Oct 2026).
-- ============================================================================
grant usage on schema public to anon, authenticated;

-- The public reads ONLY the view. Revoking the table grant is what actually
-- stops sold prices leaking — belt and braces alongside the view itself.
revoke all                            on public.cars        from anon;
grant  select                         on public.cars_public to anon, authenticated;
grant  select, insert, update, delete on public.cars        to authenticated;

grant  insert                         on public.enquiries   to anon;
grant  select, insert, update, delete on public.enquiries   to authenticated;

grant  select                         on public.admins      to authenticated;

grant execute on function public.is_admin() to anon, authenticated;


-- ============================================================================
-- 6. ADD YOURSELVES AS ADMINS
-- ----------------------------------------------------------------------------
-- FIRST: create the users in the dashboard —
--        Authentication → Users → Add user → "Create new user"
--        (tick "Auto Confirm User" so no password is needed)
--
-- THEN: edit the two email addresses below and run just this block.
-- ============================================================================

-- insert into public.admins (user_id, email)
-- select id, email from auth.users
-- where email in ('you@example.com', 'dad@example.com')
-- on conflict (user_id) do nothing;


-- Make the API pick up the new view straight away.
notify pgrst, 'reload schema';


-- ============================================================================
-- 7. CHECK IT WORKED
-- ----------------------------------------------------------------------------
-- Run each of these on its own and check the answer matches.
-- ============================================================================

-- Should list the people you added in step 6:
--   select * from public.admins;

-- Should list your tables and the view:
--   select table_name from information_schema.tables where table_schema = 'public';

-- THE IMPORTANT ONE — proves sold prices are hidden from the public.
-- Add a test car, mark it sold, then run this. `price` must come back NULL:
--   select make, model, status, price from public.cars_public where status = 'sold';

-- And this proves the public genuinely cannot reach the underlying table.
-- It must return FALSE:
--   select has_table_privilege('anon', 'public.cars', 'select');
