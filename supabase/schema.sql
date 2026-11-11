-- Pinnr Phase 2 schema
-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.

-- ─── Creators ────────────────────────────────────────────────────────────────
-- One row per signed-up creator. id = the Supabase Auth user id.
create table if not exists public.creators (
  id               uuid primary key references auth.users(id) on delete cascade,
  tiktok_username  text not null unique,
  display_name     text,
  avatar_url       text,
  last_synced_at   timestamptz,
  created_at       timestamptz not null default now()
);

-- ─── Videos ──────────────────────────────────────────────────────────────────
-- One row per synced TikTok video. Location fields are editable by the creator.
create table if not exists public.videos (
  id             uuid primary key default gen_random_uuid(),
  creator_id     uuid not null references public.creators(id) on delete cascade,
  tiktok_id      text not null,
  caption        text,
  cover_url      text,
  video_url      text,
  posted_at      timestamptz,
  place_name     text,
  category       text,
  address        text,
  lat            double precision,
  lng            double precision,
  geocode_attempted boolean not null default false,
  discount_code  text,
  featured       boolean not null default false,
  hidden         boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (creator_id, tiktok_id)
);

-- (for databases created before this column existed)
alter table public.videos add column if not exists geocode_attempted boolean not null default false;

create index if not exists videos_creator_idx on public.videos (creator_id);
create index if not exists videos_mapped_idx  on public.videos (creator_id) where lat is not null;

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table public.creators enable row level security;
alter table public.videos   enable row level security;

-- Anyone can read creator profiles (public maps).
drop policy if exists "creators are public" on public.creators;
create policy "creators are public" on public.creators
  for select using (true);

drop policy if exists "creators update own" on public.creators;
create policy "creators update own" on public.creators
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Anyone can read visible videos; creators can also read their hidden ones.
drop policy if exists "videos readable" on public.videos;
create policy "videos readable" on public.videos
  for select using (hidden = false or auth.uid() = creator_id);

drop policy if exists "videos insert own" on public.videos;
create policy "videos insert own" on public.videos
  for insert with check (auth.uid() = creator_id);

drop policy if exists "videos update own" on public.videos;
create policy "videos update own" on public.videos
  for update using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

drop policy if exists "videos delete own" on public.videos;
create policy "videos delete own" on public.videos
  for delete using (auth.uid() = creator_id);

-- ─── Auto-create a creator row on signup ─────────────────────────────────────
-- The signup form passes tiktok_username in user metadata.
create or replace function public.handle_new_creator()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.creators (id, tiktok_username, display_name)
  values (
    new.id,
    lower(trim(leading '@' from coalesce(new.raw_user_meta_data->>'tiktok_username', new.id::text))),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'tiktok_username')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_creator();

-- ═════════════════════════════════════════════════════════════════════════════
-- Admin + Featured Locations
-- ═════════════════════════════════════════════════════════════════════════════

-- Who can use /admin. Add someone with:
--   insert into public.admins (user_id)
--   select id from public.creators where tiktok_username = 'their_handle';
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

drop policy if exists "admins read self" on public.admins;
create policy "admins read self" on public.admins
  for select using (user_id = auth.uid());

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Admins can see hidden videos and edit any video.
drop policy if exists "videos readable" on public.videos;
create policy "videos readable" on public.videos
  for select using (hidden = false or auth.uid() = creator_id or public.is_admin());

drop policy if exists "videos admin update" on public.videos;
create policy "videos admin update" on public.videos
  for update using (public.is_admin()) with check (public.is_admin());

-- Three admin-picked spots shown on the home screen.
create table if not exists public.featured_locations (
  slot       smallint primary key check (slot between 1 and 3),
  video_id   uuid not null references public.videos(id) on delete cascade,
  updated_at timestamptz not null default now()
);
alter table public.featured_locations enable row level security;

drop policy if exists "featured public read" on public.featured_locations;
create policy "featured public read" on public.featured_locations
  for select using (true);

drop policy if exists "featured admin write" on public.featured_locations;
create policy "featured admin write" on public.featured_locations
  for all using (public.is_admin()) with check (public.is_admin());

-- Home screen "New POVs" query.
create index if not exists videos_new_povs_idx on public.videos (created_at desc)
  where hidden = false and lat is not null;
create index if not exists creators_created_idx on public.creators (created_at desc);
