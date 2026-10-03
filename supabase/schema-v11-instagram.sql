-- ============================================================================
-- MBU CAR SALES — SCHEMA v11: LATEST INSTAGRAM POSTS ON THE HOMEPAGE
-- ----------------------------------------------------------------------------
-- Run after the others (any time after schema.sql). Safe to run more than
-- once. Adds only: one table. Nothing else changes.
--
-- The homepage shows the six latest posts from @mbusalesltd. They get here
-- once a day, by the "Instagram posts" GitHub Action:
--
--   Behold (behold.so, free) reads the Instagram account
--     → the Action fetches Behold's feed, copies each new photo into
--       Cloudinary (where the car photos already live)
--     → and saves the post here: link, caption, the Cloudinary photo
--
-- So a visitor's browser only ever talks to this database and Cloudinary,
-- exactly as for the car photos. Nothing loads from Instagram or Behold, no
-- cookies are set, and the privacy policy needs no new company in it.
--
-- Public to read (they're public posts anyway). Only the Action, with the
-- service key, writes. An admin can hide one (hidden = true) if a post
-- shouldn't be on the website.
--
-- Until this is run, or until the Action has run once, the homepage simply
-- doesn't show the section.
-- ============================================================================

create table if not exists public.instagram_posts (
  id          text primary key,            -- Instagram's id for the post
  permalink   text not null,               -- the post on instagram.com
  media_type  text,                        -- IMAGE, VIDEO or CAROUSEL_ALBUM
  caption     text,                        -- without the hashtags
  alt_text    text,
  taken_at    timestamptz,
  image_id    text not null,               -- Cloudinary public_id of the photo
  width       integer,
  height      integer,
  position    integer not null default 0,  -- 0 = newest
  hidden      boolean not null default false,
  updated_at  timestamptz not null default now()
);

comment on table public.instagram_posts is
  'The latest Instagram posts for the homepage, copied daily by the Instagram posts GitHub Action. Public read.';

alter table public.instagram_posts enable row level security;

drop policy if exists "Anyone can see posts that aren't hidden" on public.instagram_posts;
create policy "Anyone can see posts that aren't hidden" on public.instagram_posts
  for select to anon, authenticated
  using (not hidden or public.is_admin());

drop policy if exists "Admins can hide posts" on public.instagram_posts;
create policy "Admins can hide posts" on public.instagram_posts
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.instagram_posts to anon, authenticated;
grant update (hidden) on public.instagram_posts to authenticated;

-- ----------------------------------------------------------------------------
-- Check it worked (should run without an error; empty until the Action runs):
--   select position, permalink, image_id from public.instagram_posts order by position;
--
-- Hide a post from the website:
--   update public.instagram_posts set hidden = true where permalink like '%<code from the link>%';
--
-- Undo:
--   drop table if exists public.instagram_posts;
-- ----------------------------------------------------------------------------
