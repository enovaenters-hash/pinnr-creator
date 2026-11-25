-- POVGo: spots a fan imports from their public TikTok collections ("Import my TikTok collections").
-- They show on the fan's own Group Maps (each TikTok collection becomes one group). Private to the fan.
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to re-run.

create table if not exists public.imported_spots (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tiktok_id         text not null,
  collection_id     text,
  collection_name   text,
  author_handle     text,
  author_name       text,
  caption           text,
  cover_url         text,
  video_url         text,
  place_name        text,
  address           text,
  category          text,
  lat               double precision,
  lng               double precision,
  geocode_attempted boolean not null default false,
  posted_at         timestamptz,
  created_at        timestamptz not null default now(),
  unique (user_id, tiktok_id)
);
create index if not exists imported_spots_user_idx on public.imported_spots (user_id);

alter table public.imported_spots enable row level security;

drop policy if exists "imported spots own" on public.imported_spots;
create policy "imported spots own" on public.imported_spots
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
