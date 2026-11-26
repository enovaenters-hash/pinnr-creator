-- POVGo business pages (/p/<slug>): admin-managed info for a spot. The videos themselves always come from creators.
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to re-run.

create table if not exists public.business_pages (
  slug           text primary key check (slug ~ '^[a-z0-9]{2,60}$'),      -- /p/<slug>
  name           text not null check (char_length(name) between 1 and 80),
  match_key      text not null check (match_key ~ '^[a-z0-9]{2,60}$'),    -- videos whose place name contains this (letters/numbers only)
  bio            text not null default '' check (char_length(bio) <= 600),
  address        text not null default '' check (char_length(address) <= 200),
  website        text not null default '' check (website = '' or website ~* '^https://'),
  top_video_ids  uuid[] not null default '{}' check (cardinality(top_video_ids) <= 3),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.business_pages enable row level security;

-- Anyone can read a business page; only admins create, edit or delete them (claiming comes later).
drop policy if exists "business pages read" on public.business_pages;
create policy "business pages read" on public.business_pages for select using (true);
drop policy if exists "business pages admin write" on public.business_pages;
create policy "business pages admin write" on public.business_pages
  for all using (public.is_admin()) with check (public.is_admin());
