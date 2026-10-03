-- ============================================================================
-- MBU CAR SALES — SCHEMA v9: A LIMIT ON HOW FAST THE PUBLIC CAN SEND FORMS
-- ----------------------------------------------------------------------------
-- Run after the others (any time after schema-v2-additions.sql). Safe to run
-- more than once. Adds only: one function and two triggers. No table, column
-- or existing rule changes.
--
-- The problem. The website's forms write straight into `enquiries` and
-- `wanted_requests` with the public key, which has to be public. The honeypot
-- only stops bots that fill in the page; anyone can skip the page and POST to
-- /rest/v1/enquiries as often as they like, and every row lands in the admin.
--
-- The fix. Before a row from the public is saved, the database counts what
-- arrived recently and refuses the row (it's never saved) if:
--   · the same phone number or email sent more than 3 in the last hour, or
--   · more than 10 arrived in the last 10 minutes from anyone, or
--   · more than 30 arrived in the last hour from anyone.
-- Each form is counted separately. Signed-in admins, the SQL editor and
-- anything using the service key are never limited. The numbers are in one
-- place, at the top of the function, to change later.
--
-- It also sets each public row's created_at to the database's clock, so a
-- sender can't back-date rows to slip under the count. (The website sends the
-- visitor's own clock today; the database's is the more accurate anyway.)
--
-- A real customer who's refused still gets through: the website emails every
-- enquiry through Web3Forms as well, and shows "sent" if either one works.
-- Nothing on the website needs changing.
--
-- Nothing about the sender is stored to do this (no IP address): it only
-- counts rows that are already in the tables.
-- ============================================================================

create or replace function public.limit_public_forms()
returns trigger
language plpgsql
security definer          -- the public can't read these tables, so it counts as the owner
set search_path = ''
as $$
declare
  per_contact_hour int := 3;    -- same phone or email, per hour
  burst_10min      int := 10;   -- everyone, per 10 minutes
  all_hour         int := 30;   -- everyone, per hour
  digits  text := right(regexp_replace(coalesce(new.phone, ''), '\D', '', 'g'), 10);
  mail    text := lower(trim(coalesce(new.email, '')));
  n_contact int;
  n_burst   int;
  n_hour    int;
begin
  -- Only what arrives through the website's public key is limited: the role in the
  -- request's token is 'anon' (or a signed-in user who isn't an admin). The SQL editor,
  -- the service key and admins are never limited.
  if coalesce(auth.jwt() ->> 'role', '') not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;

  -- One form at a time, so a burst of posts sent together can't all slip under the count.
  perform pg_advisory_xact_lock(hashtext('mbu_limit_' || tg_table_name));

  execute format(
    'select count(*) filter (where created_at > now() - interval ''10 minutes''),
            count(*),
            count(*) filter (where ($1 <> '''' and lower(trim(coalesce(email, ''''))) = $1)
                                or (length($2) >= 7
                                    and right(regexp_replace(coalesce(phone, ''''), ''\D'', '''', ''g''), 10) = $2))
       from public.%I
      where created_at > now() - interval ''1 hour''', tg_table_name)
    into n_burst, n_hour, n_contact
    using mail, digits;

  if n_contact >= per_contact_hour or n_burst >= burst_10min or n_hour >= all_hour then
    raise exception 'Too many messages at once. Please call or WhatsApp us instead.'
      using errcode = 'P0001', hint = 'mbu_rate_limit';
  end if;

  -- The time it arrived is the database's, not whatever the sender claimed.
  new.created_at := now();
  return new;
end;
$$;

revoke all on function public.limit_public_forms() from public, anon, authenticated;

drop trigger if exists enquiries_limit on public.enquiries;
create trigger enquiries_limit
  before insert on public.enquiries
  for each row execute function public.limit_public_forms();

drop trigger if exists wanted_requests_limit on public.wanted_requests;
create trigger wanted_requests_limit
  before insert on public.wanted_requests
  for each row execute function public.limit_public_forms();


-- ============================================================================
-- CHECK IT WORKED
--   select tgname from pg_trigger where tgname in ('enquiries_limit', 'wanted_requests_limit');
--     → two rows
--   Then send one enquiry from the website as normal: it should arrive in the
--   admin exactly as before.
--
-- If a real customer is ever refused, the website still emails it (Web3Forms),
-- and the numbers at the top of the function can go up: edit them and run
-- this file again.
-- ============================================================================

-- ============================================================================
-- UNDO (back to no limit):
--   drop trigger if exists enquiries_limit on public.enquiries;
--   drop trigger if exists wanted_requests_limit on public.wanted_requests;
--   drop function if exists public.limit_public_forms();
-- ============================================================================
