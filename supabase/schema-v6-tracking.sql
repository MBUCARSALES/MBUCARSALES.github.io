-- ============================================================================
-- MBU CAR SALES — SCHEMA v6: TRACKING THAT COUNTS PEOPLE, NOT PAGE LOADS
-- ----------------------------------------------------------------------------
-- Run AFTER schema.sql, v2, v3 and v4. Safe to run more than once.
-- It only ADDS things. Nothing is deleted and every old event is kept.
--
-- (v5 is reserved for the ops schema in Agency/08-weekend-action-plan.md.)
--
-- Why this exists
--   The old tracking made a fresh "session" on every page load, so a refresh,
--   or going back to the stock list and opening the same car again, counted as
--   another person. It had no bot filtering, no idea how long anyone spent on
--   a car or how far through the photos they got, and nothing that happened on
--   the contact page was counted at all.
--
--   v2 events come in through the `track` Edge Function, which adds three
--   things the browser can't be trusted with:
--     · visitor_hash  a scrambled code built from IP address + browser + a
--                     secret that changes every day. The IP itself is never
--                     stored. Same person, same day = same code. Tomorrow
--                     it's a different code, so nobody can be followed.
--     · is_bot        crawlers, previewers and headless browsers, flagged so
--                     they can be left out without being thrown away
--     · device        mobile / tablet / desktop, nothing finer
--
-- Old events are marked tracking_v = 1 and left exactly as they were. The new
-- `car_interest` view only counts tracking_v = 2, so rates are worked out from
-- the day the new tracking went live and old and new numbers never get mixed.
-- ============================================================================


-- ============================================================================
-- 1. NEW COLUMNS ON car_events
-- ============================================================================
alter table public.car_events add column if not exists tracking_v   smallint not null default 1;
alter table public.car_events add column if not exists visitor_hash text;
alter table public.car_events add column if not exists page_id      text;
alter table public.car_events add column if not exists duration_ms  integer;
alter table public.car_events add column if not exists photos_seen  smallint;
alter table public.car_events add column if not exists photo_count  smallint;
alter table public.car_events add column if not exists device       text;
alter table public.car_events add column if not exists is_bot       boolean not null default false;

comment on column public.car_events.tracking_v is
  '1 = old per-page-load tracking. 2 = through the track Edge Function, with visitor_hash and bot filtering.';
comment on column public.car_events.visitor_hash is
  'Daily-rotating scramble of IP + browser + secret. The IP is never stored. Same person on a different day gets a different value.';
comment on column public.car_events.page_id is
  'Random per page load. Engagement events repeat with running totals under the same page_id; take the max.';
comment on column public.car_events.duration_ms is
  'engagement events only: time the car page was actually on screen (paused while the tab is hidden).';
comment on column public.car_events.photos_seen is
  'engagement events only: how many different photos were shown, in the gallery or full screen.';


-- ============================================================================
-- 2. NEW EVENT TYPES
-- ----------------------------------------------------------------------------
--   engagement     running totals for time on the car page and photos seen
--   email_click    tapped email (the contact page offers it for a car)
--   enquire_click  tapped "Enquire now" on a car
--   video_play     started the walkaround video
-- ============================================================================
alter table public.car_events drop constraint if exists car_events_event_type_check;
alter table public.car_events add constraint car_events_event_type_check check (event_type in (
  'view', 'card_click', 'gallery_open',
  'whatsapp_click', 'phone_click', 'email_click',
  'enquire_click', 'enquiry_start', 'enquiry_sent',
  'interest_sent', 'share',
  'engagement', 'video_play'
));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'car_events_v2_guard') then
    alter table public.car_events add constraint car_events_v2_guard check (
      char_length(coalesce(visitor_hash, '')) <= 64 and
      char_length(coalesce(page_id, ''))      <= 32 and
      char_length(coalesce(device, ''))       <= 12 and
      coalesce(duration_ms, 0) between 0 and 1800000 and
      coalesce(photos_seen, 0) between 0 and 500 and
      coalesce(photo_count, 0) between 0 and 500
    );
  end if;
end $$;

create index if not exists car_events_v2_idx
  on public.car_events (car_id, event_type)
  where tracking_v = 2 and not is_bot;

-- The track function writes with the server-side key. Supabase is moving to
-- explicit grants for every API role (existing projects from 30 Oct 2026, see
-- schema.sql section 5), so spell it out rather than rely on the default.
grant select, insert on public.car_events to service_role;


-- ============================================================================
-- 3. car_interest — one row per car, counted in PEOPLE
-- ----------------------------------------------------------------------------
-- The single definition of "made contact" used everywhere from now on:
--   tapped WhatsApp, tapped call, tapped email, sent an enquiry form, or
--   registered interest in a sold car.
-- Each person counts once per car per day however many times they tap.
--
-- enquiries_total comes from the enquiries TABLE, not from tracking. It is the
-- hard number: a form that actually arrived. It also covers enquiries sent
-- from the contact page before this upgrade, which tracking never saw.
-- ============================================================================
drop view if exists public.car_interest;

create view public.car_interest as
with started as (
  select min(created_at) as at from public.car_events where tracking_v = 2
),
ev as (
  select car_id, event_type, visitor_hash, page_id, created_at,
         duration_ms, photos_seen, photo_count
  from public.car_events
  where tracking_v = 2 and not is_bot
    and visitor_hash is not null and car_id is not null
),
people as (
  select
    car_id,
    count(distinct visitor_hash) filter (where event_type = 'view')                         as visitors,
    count(distinct visitor_hash) filter (where event_type = 'view'
                                           and created_at > now() - interval '7 days')      as visitors_7d,
    count(distinct visitor_hash) filter (where event_type = 'view'
                                           and created_at <= now() - interval '7 days'
                                           and created_at >  now() - interval '14 days')    as visitors_prev_7d,
    count(distinct visitor_hash) filter (where event_type in
      ('whatsapp_click','phone_click','email_click','enquiry_sent','interest_sent'))         as contacted,
    count(distinct visitor_hash) filter (where event_type in
      ('whatsapp_click','phone_click','email_click','enquiry_sent','interest_sent')
      and created_at > now() - interval '7 days')                                           as contacted_7d,
    count(distinct visitor_hash) filter (where event_type = 'whatsapp_click')               as whatsapp_people,
    count(distinct visitor_hash) filter (where event_type = 'phone_click')                  as phone_people,
    count(distinct visitor_hash) filter (where event_type = 'email_click')                  as email_people,
    count(distinct visitor_hash) filter (where event_type = 'enquiry_sent')                 as form_people,
    count(distinct visitor_hash) filter (where event_type = 'interest_sent')                as interest_people,
    count(distinct visitor_hash) filter (where event_type = 'enquire_click')                as tapped_enquire,
    count(distinct visitor_hash) filter (where event_type = 'enquiry_start')                as started_form,
    count(distinct visitor_hash) filter (where event_type = 'gallery_open')                 as opened_photos,
    count(distinct visitor_hash) filter (where event_type = 'video_play')                   as played_video,
    count(distinct visitor_hash) filter (where event_type = 'share')                        as shared,
    max(created_at) filter (where event_type = 'view')                                      as last_viewed_at
  from ev
  group by car_id
),
-- One row per page load, holding its final running totals
visits as (
  select car_id, visitor_hash, page_id,
         max(duration_ms) as duration_ms,
         max(photos_seen) as photos_seen,
         max(photo_count) as photo_count
  from ev
  where event_type = 'engagement' and page_id is not null and duration_ms is not null
  group by car_id, visitor_hash, page_id
),
-- Each person's best visit, so someone who came back twice isn't averaged down
per_person as (
  select car_id, visitor_hash,
         max(duration_ms) as duration_ms,
         max(photos_seen) as photos_seen,
         max(photo_count) as photo_count
  from visits
  group by car_id, visitor_hash
),
engagement as (
  select
    car_id,
    count(*)                                                                   as measured_people,
    round((percentile_cont(0.5) within group (order by duration_ms) / 1000.0)::numeric)::int
                                                                               as median_seconds,
    count(*) filter (where duration_ms < 10000)                                as quick_exits,
    count(*) filter (where duration_ms >= 30000
                        or (photo_count >= 4 and photos_seen * 2 >= photo_count)) as engaged_people,
    round(avg(photos_seen), 1)                                                 as avg_photos_seen,
    round(100 * avg(case when photo_count > 0
                         then least(1.0, photos_seen::numeric / photo_count) end))::int
                                                                               as photo_depth_pct
  from per_person
  group by car_id
),
bots as (
  select car_id, count(*) as bot_events
  from public.car_events
  where tracking_v = 2 and is_bot and car_id is not null
  group by car_id
),
enq as (
  select car_id,
         count(*)                                                        as enquiries_total,
         count(*) filter (where created_at >= (select at from started))  as enquiries_since_tracking,
         max(created_at)                                                 as last_enquiry_at
  from public.enquiries
  where car_id is not null
  group by car_id
)
select
  c.id                                    as car_id,
  c.status, c.make, c.model, c.year, c.price,
  (select at from started)                as tracking_since,

  coalesce(p.visitors, 0)                 as visitors,
  coalesce(p.visitors_7d, 0)              as visitors_7d,
  coalesce(p.visitors_prev_7d, 0)         as visitors_prev_7d,
  coalesce(p.contacted, 0)                as contacted,
  coalesce(p.contacted_7d, 0)             as contacted_7d,
  coalesce(p.whatsapp_people, 0)          as whatsapp_people,
  coalesce(p.phone_people, 0)             as phone_people,
  coalesce(p.email_people, 0)             as email_people,
  coalesce(p.form_people, 0)              as form_people,
  coalesce(p.interest_people, 0)          as interest_people,
  coalesce(p.tapped_enquire, 0)           as tapped_enquire,
  coalesce(p.started_form, 0)             as started_form,
  coalesce(p.opened_photos, 0)            as opened_photos,
  coalesce(p.played_video, 0)             as played_video,
  coalesce(p.shared, 0)                   as shared,
  p.last_viewed_at,

  -- Somebody can make contact on a day they didn't open the car page (so a
  -- different visitor code), which would push this over 100%. Cap it.
  case when coalesce(p.visitors, 0) > 0
    then round(100.0 * least(p.contacted, p.visitors) / p.visitors, 1)
  end                                     as contact_rate_pct,

  coalesce(g.measured_people, 0)          as measured_people,
  g.median_seconds,
  coalesce(g.quick_exits, 0)              as quick_exits,
  coalesce(g.engaged_people, 0)           as engaged_people,
  g.avg_photos_seen,
  g.photo_depth_pct,

  coalesce(q.enquiries_total, 0)          as enquiries_total,
  coalesce(q.enquiries_since_tracking, 0) as enquiries_since_tracking,
  q.last_enquiry_at,

  coalesce(b.bot_events, 0)               as bot_events
from public.cars c
left join people     p on p.car_id = c.id
left join engagement g on g.car_id = c.id
left join bots       b on b.car_id = c.id
left join enq        q on q.car_id = c.id::text;

alter view public.car_interest set (security_invoker = true);   -- admins only, via RLS
grant select on public.car_interest to authenticated;

comment on view public.car_interest is
  'Interest per car, counted in people, from the day tracking v2 went live. Admin only.';


-- ============================================================================
-- 4. tracking_status — is the new tracking actually switched on?
-- ----------------------------------------------------------------------------
-- The admin app reads this to say "counting people since 14 September" or
-- "new tracking isn't receiving anything yet", instead of silently showing
-- zeros.
-- ============================================================================
drop view if exists public.tracking_status;

create view public.tracking_status as
select
  (select min(created_at) from public.car_events where tracking_v = 2)                as v2_since,
  (select max(created_at) from public.car_events where tracking_v = 2)                as v2_last_event,
  (select count(*) from public.car_events where tracking_v = 2 and not is_bot)        as v2_events,
  (select count(*) from public.car_events where tracking_v = 2 and is_bot)            as v2_bot_events,
  (select max(created_at) from public.car_events where tracking_v = 1)                as v1_last_event;

alter view public.tracking_status set (security_invoker = true);
grant select on public.tracking_status to authenticated;


notify pgrst, 'reload schema';


-- ============================================================================
-- 5. CHECK IT WORKED
-- ============================================================================
-- Should return one row per car, all zeros until the new tracking is live:
--   select make, model, visitors, contacted, enquiries_total from public.car_interest;

-- Every existing event should be marked as the old kind:
--   select tracking_v, count(*) from public.car_events group by 1;

-- After the track function is deployed and config.js says via: 'function',
-- open a car on the live site, then this should show a row with a visitor_hash:
--   select created_at, event_type, visitor_hash, device, is_bot
--     from public.car_events where tracking_v = 2 order by id desc limit 5;
