-- ============================================================================
-- MBU CAR SALES — SCHEMA v14: EVERY PAGE COUNTED, AND THE FIGURES ADDED UP HERE
-- ----------------------------------------------------------------------------
-- Run after schema-v6-tracking.sql. Safe to run more than once. Adds only:
-- one event type and two read-only functions for the admin app.
--
-- Why this exists (Talha, 6 Oct 2026: "how many views the site got overall per
-- week / per month and each car… the tap to contact doesn't say what they got
-- in touch for")
--
--   1. Until now only a car's own page recorded anything. The website now
--      also records every other page being opened ('page_view', no car), and
--      every WhatsApp, call and email tap wherever it is (the header, the
--      homepage, Find us…), with or without a car.
--
--      Which page and which button go in `meta`:
--        { "page": "home", "at": "header" }
--      page: home, stock, car, contact, sell, wanted, find-us, privacy, terms,
--            404, other
--      at (taps only): header, menu, bar (the phone's bottom bar), footer,
--            buy (a car's price box), hero, sell-cta, card, about-car,
--            after-form, page
--      No new column, so this file, the website and the `track` function can
--      go live in any order without one breaking another.
--
--   2. site_stats() and contact_feed() add the figures up in the database and
--      hand the admin app one small answer. Supabase only returns 1,000 rows
--      per request, so totals can't be worked out on the phone from raw events.
--
-- Same privacy as before: no cookies, no IP addresses, nothing stored on a
-- customer's phone. Bots are left out of every figure.
-- ============================================================================


-- ============================================================================
-- 0. IN CASE schema-v6 HASN'T BEEN RUN: the columns it adds (exactly as v6)
-- ============================================================================
alter table public.car_events add column if not exists tracking_v   smallint not null default 1;
alter table public.car_events add column if not exists visitor_hash text;
alter table public.car_events add column if not exists page_id      text;
alter table public.car_events add column if not exists duration_ms  integer;
alter table public.car_events add column if not exists photos_seen  smallint;
alter table public.car_events add column if not exists photo_count  smallint;
alter table public.car_events add column if not exists device       text;
alter table public.car_events add column if not exists is_bot       boolean not null default false;


-- ============================================================================
-- 1. THE NEW EVENT TYPE: page_view
-- ----------------------------------------------------------------------------
-- The full list, v6's plus page_view. (schema-v6-tracking.sql carries the same
-- list since 7 Oct 2026, so running v6 again afterwards can't undo this.)
-- ============================================================================
alter table public.car_events drop constraint if exists car_events_event_type_check;
alter table public.car_events add constraint car_events_event_type_check check (event_type in (
  'page_view',
  'view', 'card_click', 'gallery_open',
  'whatsapp_click', 'phone_click', 'email_click',
  'enquire_click', 'enquiry_start', 'enquiry_sent',
  'interest_sent', 'share',
  'engagement', 'video_play'
));

-- Only page views and contact taps can come without a car
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'car_events_car_needed') then
    alter table public.car_events add constraint car_events_car_needed check (
      car_id is not null
      or event_type in ('page_view', 'whatsapp_click', 'phone_click', 'email_click')
    ) not valid;    -- old rows aren't re-checked; every new one is
  end if;
end $$;

create index if not exists car_events_day_idx
  on public.car_events (created_at)
  where not is_bot;


-- ============================================================================
-- 2. site_stats(from, to, car) — the Website and Cars screens
-- ----------------------------------------------------------------------------
-- One answer for a stretch of time:
--   days     every day in the range (UK time): views, people, car views, taps
--   pages    each page: views, people, taps
--   sources  where page loads came from (search, facebook, autotrader…),
--            moving between our own pages left out
--   devices  people per phone / tablet / computer (new tracking only)
--   places   taps by page, button and kind
--   cars     each car: views, people, photo opens, taps by kind, shares…
--   car_days, car_sources, car_places
--            that one car's days, where its viewers came from (your stock
--            list and homepage included) and which buttons were tapped on
--            it, when p_car is given
--
-- "views" are page loads. "people" need the track function (tracking v2):
-- the same person all day counts once. Before that they're null, never a
-- guess. A person is counted once per day, so a week's people is the sum of
-- its days (the visitor code changes every day by design).
-- ============================================================================
create or replace function public.site_stats(
  p_from timestamptz,
  p_to   timestamptz default now(),
  p_car  uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  result jsonb;
  t_from timestamptz := greatest(p_from, coalesce(p_to, now()) - interval '400 days');
  t_to   timestamptz := coalesce(p_to, now());
begin
  if not public.is_admin() then
    raise exception 'Only an admin can read the figures' using errcode = '42501';
  end if;

  with ev as (
    select
      (e.created_at at time zone 'Europe/London')::date as d,
      e.car_id,
      e.event_type as k,
      coalesce(e.meta->>'page',
               case when e.meta->>'from' = 'contact' then 'contact'
                    when e.meta->>'from' = 'part_exchange' then 'sell'
                    when e.car_id is not null then 'car' end, 'other') as page,
      coalesce(e.meta->>'at', 'page') as place,
      coalesce(nullif(e.source, ''), 'direct') as source,
      case when e.tracking_v = 2 then e.visitor_hash end as who,
      case when e.tracking_v = 2 then e.device end as device
    from public.car_events e
    where e.created_at >= t_from and e.created_at < t_to
      and not e.is_bot
      and e.event_type <> 'engagement'
  ),
  span as (
    select generate_series((t_from at time zone 'Europe/London')::date,
                           ((t_to - interval '1 microsecond') at time zone 'Europe/London')::date,
                           interval '1 day')::date as d
  ),
  daily as (
    select d,
      count(*) filter (where k in ('page_view', 'view'))                         as views,
      count(distinct who) filter (where k in ('page_view', 'view'))              as people,
      count(*) filter (where who is not null)                                    as v2,
      count(*) filter (where k = 'view')                                         as car_views,
      count(*) filter (where k in ('whatsapp_click', 'phone_click', 'email_click')) as taps,
      count(distinct who) filter (where k in ('whatsapp_click', 'phone_click', 'email_click')) as tap_people,
      count(*) filter (where k = 'whatsapp_click')                               as wa,
      count(*) filter (where k = 'phone_click')                                  as phone,
      count(*) filter (where k = 'email_click')                                  as email,
      count(*) filter (where k = 'gallery_open')                                 as photos
    from ev group by d
  )
  select jsonb_build_object(
    'from', t_from,
    'to', t_to,
    'v2_since', (select min(created_at) from public.car_events where tracking_v = 2),
    'pages_since', (select min(created_at) from public.car_events where event_type = 'page_view'),
    'bots', (select count(*) from public.car_events
              where is_bot and created_at >= t_from and created_at < t_to),

    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'd', s.d,
        'views', coalesce(x.views, 0),
        'people', case when coalesce(x.v2, 0) > 0 then x.people end,
        'car_views', coalesce(x.car_views, 0),
        'taps', coalesce(x.taps, 0),
        'tap_people', case when coalesce(x.v2, 0) > 0 then x.tap_people end,
        'wa', coalesce(x.wa, 0), 'phone', coalesce(x.phone, 0), 'email', coalesce(x.email, 0),
        'photos', coalesce(x.photos, 0)
      ) order by s.d)
      from span s left join daily x on x.d = s.d), '[]'::jsonb),

    'pages', coalesce((
      select jsonb_agg(p order by (p->>'views')::int desc) from (
        select jsonb_build_object(
          'page', page,
          'views', count(*) filter (where k in ('page_view', 'view')),
          'people', nullif(count(distinct who) filter (where k in ('page_view', 'view')), 0),
          'taps', count(*) filter (where k in ('whatsapp_click', 'phone_click', 'email_click'))
        ) as p
        from ev group by page
      ) q), '[]'::jsonb),

    'sources', coalesce((
      select jsonb_agg(s order by (s->>'views')::int desc) from (
        select jsonb_build_object(
          'source', source,
          'views', count(*),
          'people', nullif(count(distinct who), 0)
        ) as s
        from ev
        where k in ('page_view', 'view') and source not in ('stock', 'home', 'internal')
        group by source
      ) q), '[]'::jsonb),

    'devices', coalesce((
      select jsonb_agg(v order by (v->>'people')::int desc) from (
        select jsonb_build_object('device', device, 'people', count(distinct who)) as v
        from ev where who is not null and device is not null
        group by device
      ) q), '[]'::jsonb),

    'places', coalesce((
      select jsonb_agg(t order by (t->>'taps')::int desc) from (
        select jsonb_build_object(
          'page', page, 'at', place, 'kind', k,
          'with_car', car_id is not null,
          'taps', count(*),
          'people', nullif(count(distinct who), 0)
        ) as t
        from ev where k in ('whatsapp_click', 'phone_click', 'email_click')
        group by page, place, k, (car_id is not null)
      ) q), '[]'::jsonb),

    'cars', coalesce((
      select jsonb_agg(c) from (
        select jsonb_build_object(
          'car_id', car_id,
          'views', count(*) filter (where k = 'view'),
          'people', nullif(count(distinct who) filter (where k = 'view'), 0),
          'card_clicks', count(*) filter (where k = 'card_click'),
          'photos', count(*) filter (where k = 'gallery_open'),
          'photo_people', nullif(count(distinct who) filter (where k = 'gallery_open'), 0),
          'taps', count(*) filter (where k in ('whatsapp_click', 'phone_click', 'email_click')),
          'tap_people', nullif(count(distinct who) filter (where k in ('whatsapp_click', 'phone_click', 'email_click')), 0),
          'wa', count(*) filter (where k = 'whatsapp_click'),
          'phone', count(*) filter (where k = 'phone_click'),
          'email', count(*) filter (where k = 'email_click'),
          'enquire', count(*) filter (where k = 'enquire_click'),
          'form_start', count(*) filter (where k = 'enquiry_start'),
          'form_sent', count(*) filter (where k = 'enquiry_sent'),
          'interest', count(*) filter (where k = 'interest_sent'),
          'shares', count(*) filter (where k = 'share'),
          'video', count(*) filter (where k = 'video_play'),
          'last_view', max(d) filter (where k = 'view')
        ) as c
        from ev where car_id is not null
        group by car_id
      ) q), '[]'::jsonb),

    'car_days', case when p_car is null then null else coalesce((
      select jsonb_agg(jsonb_build_object(
        'd', s.d,
        'views', coalesce(x.views, 0),
        'people', case when coalesce(x.v2, 0) > 0 then x.people end,
        'photos', coalesce(x.photos, 0),
        'taps', coalesce(x.taps, 0)
      ) order by s.d)
      from span s left join (
        select d,
          count(*) filter (where k = 'view') as views,
          count(distinct who) filter (where k = 'view') as people,
          count(*) filter (where who is not null) as v2,
          count(*) filter (where k = 'gallery_open') as photos,
          count(*) filter (where k in ('whatsapp_click', 'phone_click', 'email_click')) as taps
        from ev where car_id = p_car group by d
      ) x on x.d = s.d), '[]'::jsonb) end,

    'car_sources', case when p_car is null then null else coalesce((
      select jsonb_agg(s order by (s->>'views')::int desc) from (
        select jsonb_build_object('source', source, 'views', count(*), 'people', nullif(count(distinct who), 0)) as s
        from ev where car_id = p_car and k = 'view'
        group by source
      ) q), '[]'::jsonb) end,

    'car_places', case when p_car is null then null else coalesce((
      select jsonb_agg(t order by (t->>'taps')::int desc) from (
        select jsonb_build_object('page', page, 'at', place, 'kind', k, 'taps', count(*), 'people', nullif(count(distinct who), 0)) as t
        from ev where car_id = p_car and k in ('whatsapp_click', 'phone_click', 'email_click')
        group by page, place, k
      ) q), '[]'::jsonb) end
  ) into result;

  return result;
end $$;

revoke all on function public.site_stats(timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.site_stats(timestamptz, timestamptz, uuid) to authenticated;

comment on function public.site_stats(timestamptz, timestamptz, uuid) is
  'Website and per-car figures for a stretch of time, added up in the database. Admin only.';


-- ============================================================================
-- 3. contact_feed(since, limit) — "who tapped what", newest first
-- ----------------------------------------------------------------------------
-- Every WhatsApp, call and email tap: when, which car (if any), which page,
-- which button, where the visitor came from, phone or computer. With the new
-- tracking, also the cars and pages that same visitor had opened earlier
-- that day ("they'd looked at the Golf and the Corsa first"). Nobody is
-- identified: `who` is only there so taps from one visit can be grouped.
-- A tap is not a message: WhatsApp opens, whether they send anything is
-- unknowable. The messages that did arrive are in the Inbox.
-- ============================================================================
create or replace function public.contact_feed(
  p_since timestamptz default now() - interval '30 days',
  p_limit integer default 80
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can read the figures' using errcode = '42501';
  end if;

  with taps as (
    select e.id, e.created_at, e.car_id, e.event_type,
           coalesce(e.meta->>'page',
                    case when e.meta->>'from' = 'contact' then 'contact'
                         when e.car_id is not null then 'car' end, 'other') as page,
           coalesce(e.meta->>'at', 'page') as place,
           coalesce(nullif(e.source, ''), 'direct') as source,
           e.device, e.tracking_v, e.visitor_hash,
           left(coalesce(case when e.tracking_v = 2 then e.visitor_hash end, e.page_id, e.session_key, e.id::text), 12) as who
    from public.car_events e
    where e.created_at >= greatest(p_since, now() - interval '400 days')
      and not e.is_bot
      and e.event_type in ('whatsapp_click', 'phone_click', 'email_click')
    order by e.created_at desc
    limit least(greatest(coalesce(p_limit, 80), 1), 300)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'at', t.created_at,
    'kind', t.event_type,
    'car_id', t.car_id,
    'page', t.page,
    'place', t.place,
    'source', t.source,
    'device', t.device,
    'who', t.who,
    'journey', case when t.tracking_v = 2 and t.visitor_hash is not null then (
      select coalesce(jsonb_agg(j.item order by j.first_at), '[]'::jsonb) from (
        select jsonb_build_object('car_id', v.car_id, 'page', coalesce(v.meta->>'page', 'car')) as item,
               min(v.created_at) as first_at
        from public.car_events v
        where v.visitor_hash = t.visitor_hash
          and v.tracking_v = 2 and not v.is_bot
          and v.event_type in ('view', 'page_view')
          and v.created_at <= t.created_at
          and (v.created_at at time zone 'Europe/London')::date = (t.created_at at time zone 'Europe/London')::date
        group by v.car_id, coalesce(v.meta->>'page', 'car')
        order by min(v.created_at) desc
        limit 8
      ) j) end
  ) order by t.created_at desc), '[]'::jsonb)
  into result
  from taps t;

  return result;
end $$;

revoke all on function public.contact_feed(timestamptz, integer) from public, anon;
grant execute on function public.contact_feed(timestamptz, integer) to authenticated;

comment on function public.contact_feed(timestamptz, integer) is
  'The latest WhatsApp, call and email taps, with page, button and (tracking v2) what else that visitor opened that day. Admin only.';


notify pgrst, 'reload schema';


-- ============================================================================
-- 4. CHECK IT WORKED
-- ============================================================================
-- In the SQL editor you're not signed in as an admin, so the functions say
-- "Only an admin can read the figures". That's right. These check the rest:
--
--   -- page_view is now allowed (should say 'page_view' is in the list):
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'car_events_event_type_check';
--
--   -- once the website change is live, open the homepage, then:
--   select created_at, event_type, meta, source from public.car_events
--    where event_type = 'page_view' order by id desc limit 5;
--
-- The admin app's Insights → Website shows the figures.
