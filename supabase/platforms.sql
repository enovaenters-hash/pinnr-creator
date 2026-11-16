-- POVGo: connect social accounts (TikTok now, Instagram-ready) + platform tag on videos.
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to re-run.

-- Which platform a video came from. Everything so far is TikTok.
alter table public.videos add column if not exists platform text not null default 'tiktok';
alter table public.videos drop constraint if exists videos_platform_check;
alter table public.videos add constraint videos_platform_check check (platform in ('tiktok', 'instagram'));

-- PRIVATE: the access/refresh tokens from "Connect your account". RLS is on with NO policies,
-- so only the server (service-role key) can read or write this. The browser never can.
create table if not exists public.social_connections (
  creator_id         uuid not null references public.creators(id) on delete cascade,
  platform           text not null check (platform in ('tiktok', 'instagram')),
  external_id        text not null,
  handle             text,
  access_token       text not null,
  refresh_token      text not null,
  expires_at         timestamptz not null,
  refresh_expires_at timestamptz,
  scope              text,
  updated_at         timestamptz not null default now(),
  primary key (creator_id, platform),
  unique (platform, external_id)
);
alter table public.social_connections enable row level security;

-- PUBLIC: "this creator proved they own this account". Anyone can read it (for a badge);
-- nobody can write it from the browser, so it can't be faked.
create table if not exists public.creator_verified (
  creator_id  uuid not null references public.creators(id) on delete cascade,
  platform    text not null check (platform in ('tiktok', 'instagram')),
  verified_at timestamptz not null default now(),
  primary key (creator_id, platform)
);
alter table public.creator_verified enable row level security;
drop policy if exists "verified is public" on public.creator_verified;
create policy "verified is public" on public.creator_verified for select using (true);
