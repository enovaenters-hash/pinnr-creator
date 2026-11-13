-- POVGo schema
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

-- Admin: permanently delete a creator (login → profile → videos → featured slots cascade).
create or replace function public.admin_delete_creator(target uuid)
returns void
language plpgsql security definer set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can delete creators.';
  end if;
  if target = auth.uid() then
    raise exception 'You can''t delete your own account from the admin page.';
  end if;
  delete from auth.users where id = target;
end;
$$;
revoke all on function public.admin_delete_creator(uuid) from public, anon;
grant execute on function public.admin_delete_creator(uuid) to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- Fan accounts (also kept on its own in supabase/fan.sql)
-- ═════════════════════════════════════════════════════════════════════════════
-- POVGo fan accounts: follow creators, save videos, group them into lists.
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to re-run.

-- ─── Signup: only people who give a TikTok username become creators ──────────
-- Fan signups pass just a display name, so they get a login but no creator row.
create or replace function public.handle_new_creator()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  handle text := lower(trim(leading '@' from coalesce(new.raw_user_meta_data->>'tiktok_username', '')));
begin
  if handle <> '' then
    insert into public.creators (id, tiktok_username, display_name)
    values (new.id, handle, coalesce(new.raw_user_meta_data->>'display_name', handle))
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

-- A fan can become a creator later by adding their TikTok username.
drop policy if exists "creators insert own" on public.creators;
create policy "creators insert own" on public.creators
  for insert with check (auth.uid() = id);

-- ─── Saved videos ("My Videos") ──────────────────────────────────────────────
create table if not exists public.saved_videos (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  video_id   uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, video_id)
);
alter table public.saved_videos enable row level security;
drop policy if exists "saved own" on public.saved_videos;
create policy "saved own" on public.saved_videos
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── Follows (the Feed) ──────────────────────────────────────────────────────
create table if not exists public.follows (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, creator_id)
);
alter table public.follows enable row level security;
drop policy if exists "follows own" on public.follows;
create policy "follows own" on public.follows
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── Lists ("My Lists") ──────────────────────────────────────────────────────
create table if not exists public.lists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);
alter table public.lists enable row level security;
drop policy if exists "lists own" on public.lists;
create policy "lists own" on public.lists
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.list_items (
  list_id    uuid not null references public.lists(id) on delete cascade,
  video_id   uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (list_id, video_id)
);
alter table public.list_items enable row level security;
drop policy if exists "list items own" on public.list_items;
create policy "list items own" on public.list_items
  for all
  using (exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()));

create index if not exists saved_videos_user_idx on public.saved_videos (user_id, created_at desc);
create index if not exists lists_user_idx on public.lists (user_id, created_at);
create index if not exists videos_feed_idx on public.videos (creator_id, posted_at desc) where hidden = false;

-- ─── Creator content type (what fans can choose to discover) ─────────────────
-- Existing creators start as 'food'; each creator can change it in their dashboard.
alter table public.creators add column if not exists content_type text not null default 'food';
alter table public.creators drop constraint if exists creators_content_type_check;
alter table public.creators add constraint creators_content_type_check
  check (content_type in ('food', 'fashion', 'travel', 'events', 'other'));
